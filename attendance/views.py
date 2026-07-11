from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Attendance
from django.utils import timezone
import datetime
import json

from django.db import transaction

def auto_close_previous_sessions(user):
    today = timezone.now().date()
    active_prev_sessions = Attendance.objects.select_for_update().filter(user=user, is_active=True).exclude(date=today)
    for session in active_prev_sessions:
        if not session.start_time:
            session.start_time = timezone.now() - datetime.timedelta(hours=9)
        session.end_time = session.start_time + datetime.timedelta(hours=9)
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

@login_required
@transaction.atomic
def start_work(request):
    auto_close_previous_sessions(request.user)
    if request.method == 'POST':
        today = timezone.now().date()
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

        # Lock active session lookup to prevent concurrent starting of work
        active_attendance = Attendance.objects.select_for_update().filter(user=request.user, is_active=True).first()
        if active_attendance:
            return JsonResponse({'status': 'error', 'message': 'Work already started'})

        attendance, created = Attendance.objects.get_or_create(user=request.user, date=today)
        # Acquire row lock on the attendance record
        attendance = Attendance.objects.select_for_update().get(id=attendance.id)
        
        if not attendance.start_time:
            attendance.start_time = timezone.now()
            attendance.is_active = True
            if 'late_reason' in data:
                attendance.late_reason = data['late_reason']
            attendance.save()
            return JsonResponse({'status': 'success', 'start_time': attendance.start_time.isoformat()})
        return JsonResponse({'status': 'error', 'message': 'Work already started'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
@transaction.atomic
def end_work(request):
    auto_close_previous_sessions(request.user)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

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
            attendance.is_active = False
            if 'early_leave_reason' in data:
                attendance.early_leave_reason = data['early_leave_reason']
            attendance.save()
            
            from analytics.models import DailyPerformance
            perf, _ = DailyPerformance.objects.select_for_update().get_or_create(user=request.user, date=attendance.date)
            perf.hours_worked = round(attendance.duration.total_seconds() / 3600.0, 2)
            perf.attendance_points = 100
            perf.total_points = perf.attendance_points
            perf.save()
            
            return JsonResponse({
                'status': 'success',
                'end_time': attendance.end_time.isoformat(),
                'duration': str(attendance.duration),
                'total_break_duration': attendance.total_break_duration.total_seconds()
            })
        except Attendance.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'No active work session'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
@transaction.atomic
def start_break(request):
    auto_close_previous_sessions(request.user)
    if request.method == 'POST':
        try:
            attendance = Attendance.objects.select_for_update().get(user=request.user, is_active=True)
            if attendance.current_break_start:
                return JsonResponse({'status': 'error', 'message': 'Already on break'})
            attendance.current_break_start = timezone.now()
            attendance.save()
            return JsonResponse({
                'status': 'success',
                'current_break_start': attendance.current_break_start.isoformat(),
                'total_break_duration': attendance.total_break_duration.total_seconds()
            })
        except Attendance.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'No active work session'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
@transaction.atomic
def end_break(request):
    auto_close_previous_sessions(request.user)
    if request.method == 'POST':
        try:
            attendance = Attendance.objects.select_for_update().get(user=request.user, is_active=True)
            if not attendance.current_break_start:
                return JsonResponse({'status': 'error', 'message': 'Not currently on break'})
            now = timezone.now()
            elapsed = now - attendance.current_break_start
            attendance.total_break_duration += elapsed
            attendance.current_break_start = None
            attendance.save()
            return JsonResponse({
                'status': 'success',
                'total_break_duration': attendance.total_break_duration.total_seconds()
            })
        except Attendance.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'No active work session'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
@transaction.atomic
def attendance_status(request):
    auto_close_previous_sessions(request.user)
    today = timezone.now().date()
    try:
        attendance = Attendance.objects.get(user=request.user, date=today)
        return JsonResponse({
            'is_active': attendance.is_active,
            'start_time': attendance.start_time.isoformat() if attendance.start_time else None,
            'end_time': attendance.end_time.isoformat() if attendance.end_time else None,
            'total_break_duration': attendance.total_break_duration.total_seconds(),
            'current_break_start': attendance.current_break_start.isoformat() if attendance.current_break_start else None
        })
    except Attendance.DoesNotExist:
        return JsonResponse({
            'is_active': False,
            'start_time': None,
            'end_time': None,
            'total_break_duration': 0,
            'current_break_start': None
        })
