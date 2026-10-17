from django.shortcuts import render
from .models import Attendance
from django.utils import timezone
import datetime

from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

def auto_close_previous_sessions(user):
    today = timezone.now().date()
    try:
        target_hours = float(user.profile.daily_hours_target)
    except Exception:
        target_hours = 9.0
        
    active_prev_sessions = Attendance.objects.select_for_update().filter(user=user, is_active=True).exclude(date=today)
    for session in active_prev_sessions:
        if not session.start_time:
            session.start_time = timezone.now() - datetime.timedelta(hours=target_hours)
        session.end_time = session.start_time + datetime.timedelta(hours=target_hours)
        if session.current_break_start:
            session.current_break_start = None
            
        net_duration = (session.end_time - session.start_time) - session.total_break_duration
        if net_duration < datetime.timedelta(0):
            net_duration = datetime.timedelta(0)
        session.duration = net_duration
        session.is_active = False
        session.save()
        
        from analytics.models import DailyPerformance
        perf, _ = DailyPerformance.objects.select_for_update().get_or_create(user=user, date=session.date)
        perf.hours_worked = round(session.duration.total_seconds() / 3600.0, 2)
        perf.attendance_points = 100
        perf.total_points = perf.attendance_points
        perf.save()

def serialize_attendance_status(attendance):
    if not attendance:
        return {
            'is_active': False,
            'start_time': None,
            'end_time': None,
            'total_break_duration': 0,
            'current_break_start': None
        }
    return {
        'is_active': attendance.is_active,
        'start_time': attendance.start_time.isoformat() if attendance.start_time else None,
        'end_time': attendance.end_time.isoformat() if attendance.end_time else None,
        'total_break_duration': attendance.total_break_duration.total_seconds(),
        'current_break_start': attendance.current_break_start.isoformat() if attendance.current_break_start else None
    }

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def start_work(request):
    auto_close_previous_sessions(request.user)
    today = timezone.now().date()
    data = request.data

    # Lock active session lookup to prevent concurrent starting of work
    active_attendance = Attendance.objects.select_for_update().filter(user=request.user, is_active=True).first()
    if active_attendance:
        return Response({'status': 'error', 'message': 'Work already started'}, status=status.HTTP_400_BAD_REQUEST)

    attendance, created = Attendance.objects.select_for_update().get_or_create(user=request.user, date=today)
    
    if not attendance.start_time:
        attendance.start_time = timezone.now()
        attendance.is_active = True
        if 'late_reason' in data:
            attendance.late_reason = data['late_reason']
        attendance.save()
        return Response({'status': 'success', **serialize_attendance_status(attendance)})
    return Response({'status': 'error', 'message': 'Work already started'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def end_work(request):
    auto_close_previous_sessions(request.user)
    data = request.data

    try:
        # Lock the active session to prevent double clock-outs
        attendance = Attendance.objects.select_for_update().get(user=request.user, is_active=True)
        attendance.end_time = timezone.now()
        
        # If currently on break, end break automatically
        if attendance.current_break_start:
            break_elapsed = attendance.end_time - attendance.current_break_start
            attendance.total_break_duration += break_elapsed
            attendance.current_break_start = None
            
        net_duration = (attendance.end_time - attendance.start_time) - attendance.total_break_duration
        if net_duration < datetime.timedelta(0):
            net_duration = datetime.timedelta(0)
        attendance.duration = net_duration
        end_reason_val = data.get('early_leave_reason') or data.get('end_reason') or data.get('reason')
        if end_reason_val:
            attendance.early_leave_reason = end_reason_val
        attendance.save()
        
        from analytics.models import DailyPerformance
        from todos.models import Todo
        perf, _ = DailyPerformance.objects.select_for_update().get_or_create(user=request.user, date=attendance.date)
        perf.hours_worked = round(attendance.duration.total_seconds() / 3600.0, 2)
        perf.attendance_points = 100
        user_todos = Todo.objects.filter(user=request.user, date=attendance.date)
        total_todos = user_todos.count()
        completed_todos = user_todos.filter(is_completed=True).count()
        perf.todo_points = int(round((completed_todos / total_todos) * 100)) if total_todos > 0 else 100
        perf.total_points = perf.attendance_points + perf.todo_points
        perf.save()
        
        return Response({
            'status': 'success',
            'duration': str(attendance.duration),
            **serialize_attendance_status(attendance)
        })
    except Attendance.DoesNotExist:
        return Response({'status': 'error', 'message': 'No active work session'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def start_break(request):
    auto_close_previous_sessions(request.user)
    try:
        attendance = Attendance.objects.select_for_update().get(user=request.user, is_active=True)
        if attendance.current_break_start:
            return Response({'status': 'error', 'message': 'Already on break'}, status=status.HTTP_400_BAD_REQUEST)
        attendance.current_break_start = timezone.now()
        attendance.save()
        return Response({
            'status': 'success',
            **serialize_attendance_status(attendance)
        })
    except Attendance.DoesNotExist:
        return Response({'status': 'error', 'message': 'No active work session'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def end_break(request):
    auto_close_previous_sessions(request.user)
    try:
        attendance = Attendance.objects.select_for_update().get(user=request.user, is_active=True)
        if not attendance.current_break_start:
            return Response({'status': 'error', 'message': 'Not currently on break'}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        elapsed = now - attendance.current_break_start
        attendance.total_break_duration += elapsed
        attendance.current_break_start = None
        attendance.save()
        return Response({
            'status': 'success',
            **serialize_attendance_status(attendance)
        })
    except Attendance.DoesNotExist:
        return Response({'status': 'error', 'message': 'No active work session'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def attendance_status(request):
    auto_close_previous_sessions(request.user)
    today = timezone.now().date()
    try:
        attendance = Attendance.objects.get(user=request.user, date=today)
        return Response(serialize_attendance_status(attendance))
    except Attendance.DoesNotExist:
        return Response(serialize_attendance_status(None))

def format_seconds_to_duration(seconds):
    if not seconds or seconds < 0:
        return "00h 00m 00s"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}h {minutes:02d}m {secs:02d}s"

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def daily_work_summary(request):
    auto_close_previous_sessions(request.user)
    date_str = request.GET.get('date')
    if date_str:
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            target_date = timezone.now().date()
    else:
        target_date = timezone.now().date()

    attendance = Attendance.objects.filter(user=request.user, date=target_date).first()

    # User Profile Info
    profile = getattr(request.user, 'profile', None)
    daily_target_hours = float(profile.daily_hours_target) if profile and profile.daily_hours_target else 9.0
    use_fixed_schedule = profile.use_fixed_schedule if profile else False
    work_start_time = str(profile.work_start_time) if profile and profile.work_start_time else "09:00:00"
    work_end_time = str(profile.work_end_time) if profile and profile.work_end_time else "18:00:00"
    study_code = profile.study_code if profile else ""
    full_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

    # Attendance calculations
    is_active = attendance.is_active if attendance else False
    has_started = bool(attendance and attendance.start_time)
    has_ended = bool(attendance and attendance.end_time and not is_active)

    start_iso = attendance.start_time.isoformat() if (attendance and attendance.start_time) else None
    end_iso = attendance.end_time.isoformat() if (attendance and attendance.end_time) else None

    # Time values
    break_sec = int(attendance.total_break_duration.total_seconds()) if (attendance and attendance.total_break_duration) else 0
    if attendance and attendance.is_active and attendance.current_break_start:
        break_sec += int((timezone.now() - attendance.current_break_start).total_seconds())

    if attendance and attendance.start_time:
        if attendance.end_time:
            gross_sec = max(0, int((attendance.end_time - attendance.start_time).total_seconds()))
        elif attendance.is_active:
            gross_sec = max(0, int((timezone.now() - attendance.start_time).total_seconds()))
        else:
            gross_sec = 0
    else:
        gross_sec = 0

    if attendance and attendance.duration and not attendance.is_active:
        net_sec = max(0, int(attendance.duration.total_seconds()))
    else:
        net_sec = max(0, gross_sec - break_sec)

    net_hours = round(net_sec / 3600.0, 2)
    gross_hours = round(gross_sec / 3600.0, 2)
    break_hours = round(break_sec / 3600.0, 2)

    target_achieved = net_hours >= daily_target_hours
    target_pct = min(100.0, round((net_hours / daily_target_hours) * 100, 1)) if daily_target_hours > 0 else 100.0

    # Todos calculations
    from todos.models import Todo
    todos_qs = Todo.objects.filter(user=request.user, date=target_date).order_by('created_at')
    total_tasks = todos_qs.count()
    completed_tasks = todos_qs.filter(is_completed=True).count()
    pending_tasks = total_tasks - completed_tasks
    completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else (100.0 if not total_tasks else 0.0)

    task_list = []
    reopened_tasks = []
    for t in todos_qs:
        item = {
            'id': t.id,
            'title': t.title,
            'is_completed': t.is_completed,
            'uncheck_reason': t.uncheck_reason,
            'created_at': t.created_at.isoformat() if t.created_at else None,
        }
        task_list.append(item)
        if t.uncheck_reason:
            reopened_tasks.append({
                'id': t.id,
                'title': t.title,
                'reason': t.uncheck_reason,
            })

    # Performance points
    from analytics.models import DailyPerformance
    perf = DailyPerformance.objects.filter(user=request.user, date=target_date).first()
    attendance_points = perf.attendance_points if perf else (100 if has_ended else 0)
    todo_points = perf.todo_points if perf else (int(round((completed_tasks / total_tasks) * 100)) if total_tasks > 0 else 100)
    total_points = perf.total_points if perf else (attendance_points + todo_points)

    # Shift health assessment
    if target_achieved and (total_tasks == 0 or completed_tasks == total_tasks):
        shift_grade = "Outstanding"
        badge_variant = "success"
    elif target_achieved or (total_tasks > 0 and (completed_tasks / total_tasks) >= 0.75):
        shift_grade = "Good"
        badge_variant = "primary"
    else:
        shift_grade = "Needs Improvement"
        badge_variant = "warning"

    import hmac
    import hashlib
    from django.conf import settings

    secret_key = getattr(settings, 'SECRET_KEY', 'tyqro-report-secret').encode('utf-8')
    if is_active and not has_ended:
        sig_payload = f"{request.user.id}:{target_date.isoformat()}:{start_iso}:ACTIVE:{total_tasks}:{completed_tasks}".encode('utf-8')
    else:
        sig_payload = f"{request.user.id}:{target_date.isoformat()}:{gross_sec}:{net_sec}:{total_tasks}:{completed_tasks}".encode('utf-8')
    sig_raw = hmac.new(secret_key, sig_payload, hashlib.sha256).hexdigest()[:16].upper()
    security_hash = f"TYQ-SIG-{sig_raw[:4]}-{sig_raw[4:8]}-{sig_raw[8:12]}-{sig_raw[12:]}"

    report_id = f"TYQ-{target_date.strftime('%Y%m%d')}-{request.user.id}"
    try:
        verification_url = request.build_absolute_uri(f"/verify/{report_id}/?sig={sig_raw}")
    except Exception:
        verification_url = f"https://tyqro.com/verify/{report_id}/?sig={sig_raw}"

    return Response({
        'status': 'success',
        'report_id': report_id,
        'security': {
            'is_verified': True,
            'security_hash': security_hash,
            'signature': sig_raw,
            'verification_url': verification_url,
            'copyright_notice': "© 2026 Tyqro Technologies. All rights reserved. Tamper-evident official attendance record.",
        },
        'date': target_date.isoformat(),
        'date_formatted': target_date.strftime('%A, %B %d, %Y'),
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'full_name': full_name,
            'email': request.user.email,
            'study_code': study_code,
        },
        'schedule': {
            'use_fixed_schedule': use_fixed_schedule,
            'work_start_time': work_start_time,
            'work_end_time': work_end_time,
            'daily_target_hours': daily_target_hours,
        },
        'attendance': {
            'has_started': has_started,
            'has_ended': has_ended,
            'is_active': is_active,
            'start_time': start_iso,
            'end_time': end_iso,
            'gross_seconds': gross_sec,
            'gross_formatted': format_seconds_to_duration(gross_sec),
            'gross_hours': gross_hours,
            'break_seconds': break_sec,
            'break_formatted': format_seconds_to_duration(break_sec),
            'break_hours': break_hours,
            'net_seconds': net_sec,
            'net_formatted': format_seconds_to_duration(net_sec),
            'net_hours': net_hours,
            'target_achieved': target_achieved,
            'target_completion_pct': target_pct,
            'late_reason': attendance.late_reason if attendance else None,
            'early_leave_reason': attendance.early_leave_reason if attendance else None,
            'end_reason': attendance.early_leave_reason if attendance else None,
        },
        'tasks': {
            'total': total_tasks,
            'completed': completed_tasks,
            'pending': pending_tasks,
            'completion_rate': completion_rate,
            'list': task_list,
            'reopened_count': len(reopened_tasks),
            'reopened_list': reopened_tasks,
        },
        'performance': {
            'attendance_points': attendance_points,
            'todo_points': todo_points,
            'total_points': total_points,
            'shift_grade': shift_grade,
            'badge_variant': badge_variant,
        },
        'generated_at': timezone.now().isoformat(),
    })


def verify_report_public(request, report_id):
    """
    Public verification endpoint for Tyqro Daily Work Summary Reports.
    Validates HMAC-SHA256 signature against database records to prevent
    forgery, manual PDF editing, or altered attendance figures.
    """
    import re
    import hmac
    import hashlib
    from django.conf import settings
    from django.contrib.auth.models import User
    from todos.models import Todo

    match = re.match(r'^TYQ-(\d{4})(\d{2})(\d{2})-(\d+)$', report_id.strip())
    if not match:
        return render(request, 'verify_report.html', {
            'is_valid': False,
            'report_id': report_id,
            'error_title': 'Invalid Report Identifier',
            'error_message': 'The provided Report ID format is invalid or corrupted. Official Tyqro report IDs follow the format TYQ-YYYYMMDD-USERID.',
        }, status=400)

    year, month, day, user_id_str = match.groups()
    try:
        target_date = datetime.date(int(year), int(month), int(day))
        user_id = int(user_id_str)
    except Exception:
        return render(request, 'verify_report.html', {
            'is_valid': False,
            'report_id': report_id,
            'error_title': 'Date or User Parse Error',
            'error_message': 'The date or employee identifier within the Report ID could not be parsed.',
        }, status=400)

    user = User.objects.filter(id=user_id).first()
    if not user:
        return render(request, 'verify_report.html', {
            'is_valid': False,
            'report_id': report_id,
            'error_title': 'Employee Not Found',
            'error_message': f'No registered Tyqro team member corresponds to employee ID {user_id}.',
        }, status=404)

    attendance = Attendance.objects.filter(user=user, date=target_date).first()

    break_sec = int(attendance.total_break_duration.total_seconds()) if (attendance and attendance.total_break_duration) else 0
    if attendance and attendance.is_active and attendance.current_break_start:
        break_sec += int((timezone.now() - attendance.current_break_start).total_seconds())

    if attendance and attendance.start_time:
        if attendance.end_time:
            gross_sec = max(0, int((attendance.end_time - attendance.start_time).total_seconds()))
        elif attendance.is_active:
            gross_sec = max(0, int((timezone.now() - attendance.start_time).total_seconds()))
        else:
            gross_sec = 0
    else:
        gross_sec = 0

    if attendance and attendance.duration and not attendance.is_active:
        net_sec = max(0, int(attendance.duration.total_seconds()))
    else:
        net_sec = max(0, gross_sec - break_sec)

    tasks = Todo.objects.filter(user=user, date=target_date)
    total_tasks = tasks.count()
    completed_tasks = tasks.filter(is_completed=True).count()

    secret_key = getattr(settings, 'SECRET_KEY', 'tyqro-report-secret').encode('utf-8')
    sig_payload_completed = f"{user.id}:{target_date.isoformat()}:{gross_sec}:{net_sec}:{total_tasks}:{completed_tasks}".encode('utf-8')
    sig_completed = hmac.new(secret_key, sig_payload_completed, hashlib.sha256).hexdigest()[:16].upper()

    expected_sigs = [sig_completed]
    if attendance and attendance.start_time:
        sig_payload_active = f"{user.id}:{target_date.isoformat()}:{attendance.start_time.isoformat()}:ACTIVE:{total_tasks}:{completed_tasks}".encode('utf-8')
        expected_sigs.append(hmac.new(secret_key, sig_payload_active, hashlib.sha256).hexdigest()[:16].upper())

    provided_sig = request.GET.get('sig', '').strip().upper()
    is_valid = bool(provided_sig and any(hmac.compare_digest(exp, provided_sig) for exp in expected_sigs))

    active_hash_sig = provided_sig if is_valid else sig_completed
    security_hash = f"TYQ-SIG-{active_hash_sig[:4]}-{active_hash_sig[4:8]}-{active_hash_sig[8:12]}-{active_hash_sig[12:]}"
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username
    study_code = getattr(getattr(user, 'profile', None), 'study_code', f"EMP-{user.id:04d}")

    def format_sec(s):
        h = s // 3600
        m = (s % 3600) // 60
        sec = s % 60
        return f"{h:02d}h {m:02d}m {sec:02d}s"

    def format_clock(dt):
        if not dt:
            return 'N/A'
        try:
            return dt.strftime('%I:%M:%S %p')
        except Exception:
            return str(dt)

    return render(request, 'verify_report.html', {
        'is_valid': is_valid,
        'report_id': report_id,
        'provided_sig': provided_sig or 'None',
        'security_hash': security_hash,
        'employee_name': full_name,
        'username': user.username,
        'email': user.email,
        'study_code': study_code,
        'date_formatted': target_date.strftime('%A, %B %d, %Y'),
        'has_attendance': attendance is not None,
        'clock_in': format_clock(attendance.start_time) if (attendance and attendance.start_time) else 'Not Clocked In',
        'clock_out': format_clock(attendance.end_time) if (attendance and attendance.end_time) else ('Active / In Progress' if (attendance and attendance.is_active) else 'Shift Ended'),
        'gross_formatted': format_sec(gross_sec),
        'break_formatted': format_sec(break_sec),
        'net_formatted': format_sec(net_sec),
        'tasks_completed': completed_tasks,
        'total_tasks': total_tasks,
        'tasks_list': list(tasks.values('title', 'is_completed', 'uncheck_reason')),
        'end_reason': attendance.early_leave_reason if attendance else None,
        'late_reason': attendance.late_reason if attendance else None,
        'verified_at': timezone.now().strftime('%B %d, %Y %I:%M:%S %p %Z'),
    })


