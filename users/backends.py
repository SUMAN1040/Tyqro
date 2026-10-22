from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        email = kwargs.get('email', username)
        if not email or not password:
            return None
        email = email.strip().lower()

        try:
            # Prefer active users first in case an inactive duplicate exists
            user = User.objects.filter(email__iexact=email).order_by('-is_active', '-id').first()
            if user and user.check_password(password) and self.user_can_authenticate(user):
                return user
        except Exception:
            return None
        return None
