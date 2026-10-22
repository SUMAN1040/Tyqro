from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Todo(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    date = models.DateField(default=timezone.now, db_index=True)
    is_completed = models.BooleanField(default=False)
    uncheck_reason = models.TextField(null=True, blank=True)
    total_seconds = models.PositiveIntegerField(default=0)
    timer_started_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def pause_timer(self, commit=True):
        """If timer is running, accumulate elapsed seconds and stop the timer."""
        if self.timer_started_at:
            now = timezone.now()
            elapsed = (now - self.timer_started_at).total_seconds()
            self.total_seconds += max(0, int(elapsed))
            self.timer_started_at = None
            if commit:
                self.save(update_fields=['total_seconds', 'timer_started_at'])

    @property
    def is_timer_running(self):
        return self.timer_started_at is not None

    @property
    def current_total_seconds(self):
        secs = self.total_seconds or 0
        if self.timer_started_at:
            elapsed = (timezone.now() - self.timer_started_at).total_seconds()
            secs += max(0, int(elapsed))
        return secs

    class Meta:
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['user', 'timer_started_at']),
        ]

    def __str__(self):
        return self.title
