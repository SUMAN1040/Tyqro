from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import datetime

class Attendance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.now)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)
    late_reason = models.TextField(null=True, blank=True)
    early_leave_reason = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    total_break_duration = models.DurationField(default=datetime.timedelta(0))
    current_break_start = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        return f"{self.user.username} - {self.date}"
