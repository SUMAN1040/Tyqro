from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import DailyPerformance
from attendance.models import Attendance
from todos.models import Todo
from django.utils import timezone
import datetime

@login_required
def analytics_data(request):
    year = request.GET.get('year')
    now = timezone.now()
    current_year = now.year
    
    # Get available years from user's join date to current year
    start_year = request.user.date_joined.year if request.user.date_joined else current_year
    available_years = list(range(current_year, start_year - 1, -1))
    if current_year not in available_years:
        available_years.insert(0, current_year)

    if year:
        try:
            target_year = int(year)
        except ValueError:
            target_year = current_year
    else:
        target_year = current_year

    start_date = datetime.date(target_year, 1, 1)
    end_date = datetime.date(target_year, 12, 31)
    performances = DailyPerformance.objects.filter(user=request.user, date__range=(start_date, end_date))
    todos = Todo.objects.filter(user=request.user, date__range=(start_date, end_date))

    data_map = {}
    
    for perf in performances:
        date_str = perf.date.isoformat()
        data_map[date_str] = {
            'date': date_str,
            'hours': float(perf.hours_worked),
            'tasks_completed': 0,
            'total_tasks': 0
        }
        
    for t in todos:
        date_str = t.date.isoformat()
        if date_str not in data_map:
            data_map[date_str] = {
                'date': date_str,
                'hours': 0.0,
                'tasks_completed': 0,
                'total_tasks': 0
            }
        data_map[date_str]['total_tasks'] += 1
        if t.is_completed:
            data_map[date_str]['tasks_completed'] += 1

    data = list(data_map.values())
    return JsonResponse({'status': 'success', 'data': data, 'years': available_years, 'selected_year': target_year})
