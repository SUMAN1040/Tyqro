from rest_framework import serializers
from .models import Todo

class TodoSerializer(serializers.ModelSerializer):
    is_timer_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = Todo
        fields = [
            'id', 'title', 'date', 'is_completed', 'uncheck_reason',
            'total_seconds', 'timer_started_at', 'is_timer_running', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'is_timer_running']
