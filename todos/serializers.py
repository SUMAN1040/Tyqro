from rest_framework import serializers
from .models import Todo

class TodoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Todo
        fields = ['id', 'title', 'date', 'is_completed', 'created_at']
        read_only_fields = ['id', 'created_at']
