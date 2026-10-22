from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
import datetime
from .models import Todo
from .serializers import TodoSerializer
from attendance.models import Attendance

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def todo_list(request):
    date_str = request.GET.get('date')
    if date_str:
        try:
            target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = timezone.now().date()
    else:
        target_date = timezone.now().date()

    todos = Todo.objects.filter(user=request.user, date=target_date).order_by('created_at')
    serializer = TodoSerializer(todos, many=True)
    return Response({'todos': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_todo(request):
    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'Title is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(title) > 255:
        return Response({'error': 'Title cannot exceed 255 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if work has started
    today = timezone.now().date()
    attendance = Attendance.objects.filter(user=request.user, date=today).first()
    if attendance and attendance.start_time:
        return Response({'error': 'Cannot add tasks after starting work.'}, status=status.HTTP_400_BAD_REQUEST)

    todo = Todo.objects.create(user=request.user, title=title, date=today)
    serializer = TodoSerializer(todo)
    return Response({'status': 'success', 'todo': serializer.data}, status=status.HTTP_201_CREATED)

@api_view(['PUT', 'PATCH', 'POST'])
@permission_classes([IsAuthenticated])
def edit_todo(request, todo_id):
    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)

    # If work session for that day is already completed, disallow modifying task title
    attendance = Attendance.objects.filter(user=request.user, date=todo.date).first()
    if attendance and attendance.end_time and not attendance.is_active:
        return Response({'error': 'Cannot edit tasks for an already completed work day.'}, status=status.HTTP_400_BAD_REQUEST)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'Title cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(title) > 255:
        return Response({'error': 'Title cannot exceed 255 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    todo.title = title
    todo.save(update_fields=['title'])
    return Response({'status': 'success', 'todo': TodoSerializer(todo).data})

@api_view(['POST', 'PATCH'])
@permission_classes([IsAuthenticated])
def toggle_todo(request, todo_id):
    # Can only toggle todos if the work session is active
    active_attendance = Attendance.objects.filter(user=request.user, is_active=True).first()
    if not active_attendance:
        return Response({'error': 'Cannot complete tasks unless work session is active.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
        if todo.date != active_attendance.date:
            return Response({'error': 'Cannot modify tasks from a different date during active session.'}, status=status.HTTP_400_BAD_REQUEST)

        # If task is already completed, unchecking requires a minimum 10-word explanation
        if todo.is_completed:
            reason = request.data.get('reason', '').strip()
            word_count = len([w for w in reason.split() if w])
            if word_count < 10:
                return Response({
                    'error': f'A minimum 10-word reason is required to uncheck a completed task. You provided {word_count} words.'
                }, status=status.HTTP_400_BAD_REQUEST)
            todo.uncheck_reason = reason
            todo.is_completed = False
        else:
            # Completing task: automatically pause/commit any active task timer
            if todo.timer_started_at:
                todo.pause_timer(commit=False)
            todo.is_completed = True
        todo.save()
        serializer = TodoSerializer(todo)
        return Response({
            'status': 'success',
            'is_completed': todo.is_completed,
            'uncheck_reason': todo.uncheck_reason,
            'todo': serializer.data
        })
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_task_timer(request, todo_id):
    attendance = Attendance.objects.filter(user=request.user, is_active=True).first()
    if not attendance:
        return Response({'error': 'Please start your work session before starting a task timer.'}, status=status.HTTP_400_BAD_REQUEST)
    if attendance.current_break_start:
        return Response({'error': 'Cannot start a task timer while on break.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
        if todo.date != attendance.date:
            return Response({'error': 'Cannot start a timer for a task from another date.'}, status=status.HTTP_400_BAD_REQUEST)
        if todo.is_completed:
            return Response({'error': 'Cannot start a timer for an already completed task.'}, status=status.HTTP_400_BAD_REQUEST)

        # Single active task rule: Pause any other running task timers for this user
        other_running_todos = Todo.objects.filter(user=request.user, timer_started_at__isnull=False).exclude(id=todo.id)
        for t in other_running_todos:
            t.pause_timer(commit=True)

        if not todo.timer_started_at:
            todo.timer_started_at = timezone.now()
            todo.save(update_fields=['timer_started_at'])

        todos = Todo.objects.filter(user=request.user, date=todo.date).order_by('created_at')
        return Response({
            'status': 'success',
            'todo': TodoSerializer(todo).data,
            'todos': TodoSerializer(todos, many=True).data
        })
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pause_task_timer(request, todo_id):
    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
        todo.pause_timer(commit=True)

        todos = Todo.objects.filter(user=request.user, date=todo.date).order_by('created_at')
        return Response({
            'status': 'success',
            'todo': TodoSerializer(todo).data,
            'todos': TodoSerializer(todos, many=True).data
        })
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def delete_todo(request, todo_id):
    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Check attendance for this task's specific date
    attendance = Attendance.objects.filter(user=request.user, date=todo.date).first()
    if attendance and attendance.start_time:
        return Response({'error': 'Cannot delete tasks for a day where work has already started.'}, status=status.HTTP_400_BAD_REQUEST)

    todo.delete()
    return Response({'status': 'success'})
