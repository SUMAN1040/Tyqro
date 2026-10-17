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
    title = request.data.get('title')
    if not title:
        return Response({'error': 'Title is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if work has started
    today = timezone.now().date()
    attendance = Attendance.objects.filter(user=request.user, date=today).first()
    if attendance and attendance.start_time:
        return Response({'error': 'Cannot add tasks after starting work.'}, status=status.HTTP_400_BAD_REQUEST)

    todo = Todo.objects.create(user=request.user, title=title, date=today)
    serializer = TodoSerializer(todo)
    return Response({'status': 'success', 'todo': serializer.data}, status=status.HTTP_201_CREATED)

@api_view(['POST', 'PATCH'])
@permission_classes([IsAuthenticated])
def toggle_todo(request, todo_id):
    # Can only toggle todos if the work session is active
    if not Attendance.objects.filter(user=request.user, is_active=True).exists():
        return Response({'error': 'Cannot complete tasks unless work session is active.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
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
            todo.is_completed = True
        todo.save()
        return Response({'status': 'success', 'is_completed': todo.is_completed, 'uncheck_reason': todo.uncheck_reason})
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def delete_todo(request, todo_id):
    # Cannot delete tasks after starting or ending work for today
    today = timezone.now().date()
    attendance = Attendance.objects.filter(user=request.user, date=today).first()
    if attendance and attendance.start_time:
        return Response({'error': 'Cannot delete tasks after starting work.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        todo = Todo.objects.get(id=todo_id, user=request.user)
        todo.delete()
        return Response({'status': 'success'})
    except Todo.DoesNotExist:
        return Response({'error': 'Todo not found.'}, status=status.HTTP_404_NOT_FOUND)
