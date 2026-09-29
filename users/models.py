import secrets
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

def generate_unique_study_code():
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        code = 'TYQ-' + ''.join(secrets.choice(chars) for _ in range(6))
        if not UserProfile.objects.filter(study_code=code).exists():
            return code

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    daily_hours_target = models.DecimalField(max_digits=4, decimal_places=2, default=9.00)
    work_days = models.CharField(max_length=100, default='Mon,Tue,Wed,Thu,Fri,Sat,Sun')
    use_fixed_schedule = models.BooleanField(default=False)
    work_start_time = models.TimeField(default="09:00:00")
    work_end_time = models.TimeField(default="18:00:00")
    otp_code = models.CharField(max_length=6, null=True, blank=True)
    otp_purpose = models.CharField(max_length=50, null=True, blank=True)
    otp_pending_email = models.EmailField(null=True, blank=True)
    study_code = models.CharField(max_length=16, unique=True, null=True, blank=True, db_index=True)

    def get_or_create_study_code(self):
        if not self.study_code:
            self.study_code = generate_unique_study_code()
            self.save(update_fields=['study_code'])
        return self.study_code

    def __str__(self):
        return f"{self.user.username}'s Profile"

class StudyGroup(models.Model):
    code = models.CharField(max_length=16, unique=True, db_index=True)
    creator = models.OneToOneField(User, on_delete=models.CASCADE, related_name='created_study_group')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Group ({self.code}) created by {self.creator.username}"

class StudyGroupMembership(models.Model):
    group = models.ForeignKey(StudyGroup, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_group_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in group {self.group.code}"

@receiver(post_save, sender=User)
def create_or_save_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        try:
            instance.profile.save()
        except UserProfile.DoesNotExist:
            UserProfile.objects.create(user=instance)

