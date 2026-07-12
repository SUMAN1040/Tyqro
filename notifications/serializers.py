from rest_framework import serializers
from .models import NotificationLog

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = ['id', 'message', 'created_at', 'is_read']
