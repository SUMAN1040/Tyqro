from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import NotificationLog
from .serializers import NotificationSerializer

@api_view(['GET'])
def unread_notifications(request):
    notifs = NotificationLog.objects.filter(user=request.user, is_read=False).order_by('-created_at')
    serializer = NotificationSerializer(notifs, many=True)
    return Response({'notifications': serializer.data})

@api_view(['POST'])
def mark_read(request):
    NotificationLog.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'success'})
