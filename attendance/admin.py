from django.contrib import admin
from .models import Attendance

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'start_time', 'end_time', 'duration', 'is_active')
    list_filter = ('date', 'is_active')
    search_fields = ('user__username',)
