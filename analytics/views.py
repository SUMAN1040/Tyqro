from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import DailyPerformance
from attendance.models import Attendance
from todos.models import Todo
from django.utils import timezone
from django.db.models import Count, Q
import datetime

@api_view(['GET'])
@permission_classes([IsAuthenticated])
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
    todos = Todo.objects.filter(user=request.user, date__range=(start_date, end_date)) \
        .values('date') \
        .annotate(
            total=Count('id'),
            completed=Count('id', filter=Q(is_completed=True))
        )

    data_map = {}
    
    for perf in performances:
        date_str = perf.date.isoformat()
        data_map[date_str] = {
            'date': date_str,
            'hours': float(perf.hours_worked),
            'tasks_completed': 0,
            'total_tasks': 0
        }
        
    for item in todos:
        date_str = item['date'].isoformat()
        if date_str not in data_map:
            data_map[date_str] = {
                'date': date_str,
                'hours': 0.0,
                'tasks_completed': 0,
                'total_tasks': 0
            }
        data_map[date_str]['total_tasks'] = item['total']
        data_map[date_str]['tasks_completed'] = item['completed']

    # Include live today's attendance calculation so active work reflects immediately in heatmap & stats
    today = now.date()
    if today.year == target_year:
        today_str = today.isoformat()
        today_att = Attendance.objects.filter(user=request.user, date=today).first()
        if today_att:
            live_hours = 0.0
            if today_att.is_active and today_att.start_time:
                active_break = (now - today_att.current_break_start).total_seconds() if today_att.current_break_start else 0
                accum_break = today_att.total_break_duration.total_seconds() + active_break
                elapsed = max(0, (now - today_att.start_time).total_seconds())
                net_seconds = max(0, elapsed - accum_break)
                live_hours = round(net_seconds / 3600.0, 2)
            elif today_att.duration:
                live_hours = round(today_att.duration.total_seconds() / 3600.0, 2)

            if today_str not in data_map:
                data_map[today_str] = {
                    'date': today_str,
                    'hours': live_hours,
                    'tasks_completed': 0,
                    'total_tasks': 0
                }
            else:
                data_map[today_str]['hours'] = max(data_map[today_str]['hours'], live_hours)

    data = list(data_map.values())
    return Response({'status': 'success', 'data': data, 'years': available_years, 'selected_year': target_year})
