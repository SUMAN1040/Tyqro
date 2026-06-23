from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class DailyPerformance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.now)
    attendance_points = models.IntegerField(default=0)
    todo_points = models.IntegerField(default=0)
    hours_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    total_points = models.IntegerField(default=0)

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.total_points}pts"
