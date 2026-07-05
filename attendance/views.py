from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Attendance
from django.utils import timezone
import datetime
import json

@login_required
def start_work(request):
    if request.method == 'POST':
        today = timezone.now().date()
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

        attendance, created = Attendance.objects.get_or_create(user=request.user, date=today)
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
def end_work(request):
    if request.method == 'POST':
        today = timezone.now().date()
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

        try:
            attendance = Attendance.objects.get(user=request.user, date=today, is_active=True)
            attendance.end_time = timezone.now()
            attendance.duration = attendance.end_time - attendance.start_time
            attendance.is_active = False
            if 'early_leave_reason' in data:
                attendance.early_leave_reason = data['early_leave_reason']
            attendance.save()
            
            from analytics.models import DailyPerformance
            perf, _ = DailyPerformance.objects.get_or_create(user=request.user, date=today)
            perf.hours_worked = round(attendance.duration.total_seconds() / 3600.0, 2)
            perf.attendance_points = 100
            perf.total_points = perf.attendance_points
            perf.save()
            
            # Automatically clear all todo list items for today upon ending the work session
            from todos.models import Todo
            Todo.objects.filter(user=request.user, date=today).delete()
            
            return JsonResponse({'status': 'success', 'end_time': attendance.end_time.isoformat(), 'duration': str(attendance.duration)})
        except Attendance.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'No active work session'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
def attendance_status(request):
    today = timezone.now().date()
    try:
        attendance = Attendance.objects.get(user=request.user, date=today)
        return JsonResponse({
            'is_active': attendance.is_active,
            'start_time': attendance.start_time.isoformat() if attendance.start_time else None,
            'end_time': attendance.end_time.isoformat() if attendance.end_time else None
        })
    except Attendance.DoesNotExist:
        return JsonResponse({'is_active': False, 'start_time': None, 'end_time': None})
