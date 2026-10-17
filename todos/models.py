from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Todo(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    date = models.DateField(default=timezone.now, db_index=True)
    is_completed = models.BooleanField(default=False)
    uncheck_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
