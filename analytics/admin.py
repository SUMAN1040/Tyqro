from django.contrib import admin
from .models import DailyPerformance

@admin.register(DailyPerformance)
class DailyPerformanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'attendance_points', 'todo_points', 'hours_worked', 'total_points')
    list_filter = ('date',)
    search_fields = ('user__username',)
