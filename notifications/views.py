from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import NotificationLog

@login_required
def unread_notifications(request):
    notifs = NotificationLog.objects.filter(user=request.user, is_read=False).values('id', 'message', 'created_at')
    return JsonResponse({'notifications': list(notifs)})

@login_required
def mark_read(request):
    if request.method == 'POST':
        NotificationLog.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)
