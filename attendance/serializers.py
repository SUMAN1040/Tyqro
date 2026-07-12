from rest_framework import serializers
from .models import Attendance

class AttendanceSerializer(serializers.ModelSerializer):
    total_break_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'date', 'start_time', 'end_time', 'duration', 
            'late_reason', 'early_leave_reason', 'is_active', 
            'total_break_duration', 'total_break_seconds', 'current_break_start'
        ]
        read_only_fields = ['id', 'duration']

    def get_total_break_seconds(self, obj):
        return obj.total_break_duration.total_seconds()
