from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import NotificationLog
from .serializers import NotificationSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_notifications(request):
    notifs = NotificationLog.objects.filter(user=request.user, is_read=False).order_by('-created_at')
    serializer = NotificationSerializer(notifs, many=True)
    return Response({'notifications': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request):
    NotificationLog.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'success'})
