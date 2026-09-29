from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['daily_hours_target', 'work_days', 'use_fixed_schedule', 'work_start_time', 'work_end_time', 'avatar_url', 'study_code']

    def get_avatar_url(self, obj):
        if obj.avatar:
            try:
                return obj.avatar.url
            except Exception:
                return None
        return None

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']
