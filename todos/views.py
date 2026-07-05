from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Todo
import json
from django.utils import timezone

@login_required
def todo_list(request):
    today = timezone.now().date()
    todos = Todo.objects.filter(user=request.user, date=today).order_by('created_at').values('id', 'title', 'is_completed')
    return JsonResponse({'todos': list(todos)})

@login_required
def add_todo(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        title = data.get('title')
        if title:
            # Check if work has started
            from attendance.models import Attendance
            attendance = Attendance.objects.filter(user=request.user, date=timezone.now().date()).first()
            if attendance and attendance.start_time:
                return JsonResponse({'status': 'error', 'message': 'Cannot add tasks after starting work.'})
                
            todo = Todo.objects.create(user=request.user, title=title, date=timezone.now().date())
            return JsonResponse({'status': 'success', 'todo': {'id': todo.id, 'title': todo.title, 'is_completed': todo.is_completed}})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
def toggle_todo(request, todo_id):
    if request.method == 'POST':
        # Can only toggle todos if the work session is active
        from attendance.models import Attendance
        if not Attendance.objects.filter(user=request.user, is_active=True).exists():
            return JsonResponse({'status': 'error', 'message': 'Cannot complete tasks unless work session is active.'}, status=400)

        try:
            todo = Todo.objects.get(id=todo_id, user=request.user)
            todo.is_completed = not todo.is_completed
            todo.save()
            return JsonResponse({'status': 'success', 'is_completed': todo.is_completed})
        except Todo.DoesNotExist:
            return JsonResponse({'status': 'error'}, status=404)
    return JsonResponse({'status': 'error'}, status=400)

@login_required
def delete_todo(request, todo_id):
    if request.method == 'POST':
        # Cannot delete tasks after ending work for today
        from attendance.models import Attendance
        today = timezone.now().date()
        if Attendance.objects.filter(user=request.user, date=today, is_active=False, end_time__isnull=False).exists():
            return JsonResponse({'status': 'error', 'message': 'Cannot delete tasks after ending work.'}, status=400)

        try:
            todo = Todo.objects.get(id=todo_id, user=request.user)
            todo.delete()
            return JsonResponse({'status': 'success'})
        except Todo.DoesNotExist:
            return JsonResponse({'status': 'error'}, status=404)
    return JsonResponse({'status': 'error'}, status=400)
