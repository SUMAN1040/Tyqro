import random
import datetime
import threading
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .serializers import UserSerializer, UserProfileSerializer

def send_email_async(email_message):
    def _send():
        try:
            email_message.send()
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Failed to send email: %s", e)
    thread = threading.Thread(target=_send)
    thread.daemon = True
    thread.start()

@api_view(['POST'])
@permission_classes([AllowAny])
def signup_view(request):
    data = request.data
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    password_confirm = data.get('password_confirm', '')

    if not (first_name and last_name and email and password and password_confirm):
        return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if password != password_confirm:
        return Response({'error': "Passwords don't match."}, status=status.HTTP_400_BAD_REQUEST)

    active_exists = (
        User.objects.filter(email__iexact=email, is_active=True).exists() or
        User.objects.filter(username__iexact=email[:150], is_active=True).exists()
    )
    if active_exists:
        return Response({'error': 'This email address is already registered. Please sign in.'}, status=status.HTTP_400_BAD_REQUEST)

    # Clean up any unverified/inactive accounts with this email or username
    User.objects.filter(email__iexact=email, is_active=False).delete()
    User.objects.filter(username__iexact=email[:150], is_active=False).delete()

    try:
        validate_password(password)
    except ValidationError as e:
        return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.create_user(
            username=email[:150],
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=False
        )
    except Exception as e:
        return Response({'error': f'Failed to create account: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    otp = str(random.randint(100000, 999999))
    from .models import UserProfile
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.otp_code = otp
    profile.otp_purpose = 'signup'
    profile.save()

    mail_subject = 'Your Tyqro Verification Code'
    message = f"Hi {user.first_name},\n\nThank you for signing up for Tyqro. Your 6-digit email verification code is:\n\n{otp}\n\nPlease enter this code to activate your account.\n\nThanks!"
    email_msg = EmailMessage(mail_subject, message, to=[email])
    send_email_async(email_msg)

    return Response({'status': 'success', 'user_id': user.id}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    user_id = request.data.get('user_id')
    entered_otp = request.data.get('otp', '').strip()

    if not user_id or not entered_otp:
        return Response({'error': 'User ID and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

    user = get_object_or_404(User, id=user_id)
    profile = user.profile

    if profile.otp_code == entered_otp and profile.otp_purpose == 'signup':
        user.is_active = True
        user.save()
        profile.otp_code = None
        profile.otp_purpose = None
        profile.save()
        return Response({'status': 'success', 'message': 'Account verified successfully!'})
    else:
        return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_profile(request):
    user = request.user
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    new_email = request.data.get('email', '').strip().lower()
    
    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    user.save()

    avatar = request.FILES.get('avatar')
    if avatar:
        if avatar.size > 100 * 1024:
            return Response({'error': 'Profile image must be less than 100KB.'}, status=status.HTTP_400_BAD_REQUEST)
        user.profile.avatar = avatar
        user.profile.save()

    if new_email and new_email != user.email:
        if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
            return Response({'error': 'This email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

        otp = str(random.randint(100000, 999999))
        user.profile.otp_code = otp
        user.profile.otp_purpose = 'email_update'
        user.profile.otp_pending_email = new_email
        user.profile.save()

        mail_subject = 'Verify Your New Email Address'
        message = f"Hi {user.first_name},\n\nWe received a request to update your email. Your verification code is:\n\n{otp}\n\nThanks!"
        email_msg = EmailMessage(mail_subject, message, to=[new_email])
        send_email_async(email_msg)

        return Response({'status': 'verification_pending', 'email': new_email})

    serializer = UserSerializer(user)
    return Response({'status': 'success', 'user': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_email_update(request):
    user = request.user
    entered_otp = request.data.get('otp', '').strip()
    profile = user.profile

    if profile.otp_purpose == 'email_update' and profile.otp_code == entered_otp and profile.otp_pending_email:
        user.email = profile.otp_pending_email
        user.username = profile.otp_pending_email[:150]
        user.save()
        
        profile.otp_code = None
        profile.otp_purpose = None
        profile.otp_pending_email = None
        profile.save()

        serializer = UserSerializer(user)
        return Response({'status': 'success', 'user': serializer.data})
    else:
        return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old_password = request.data.get('old_password', '')
    new_password = request.data.get('new_password', '')

    if not user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user)
    except ValidationError as e:
        return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({'status': 'success', 'message': 'Password changed successfully.'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_preferences(request):
    profile = request.user.profile
    use_fixed_schedule = request.data.get('use_fixed_schedule') == True
    profile.use_fixed_schedule = use_fixed_schedule

    if use_fixed_schedule:
        start_time_str = request.data.get('work_start_time', "09:00")
        end_time_str = request.data.get('work_end_time', "18:00")
        profile.work_start_time = start_time_str
        profile.work_end_time = end_time_str

        try:
            t1 = datetime.datetime.strptime(start_time_str, "%H:%M")
            t2 = datetime.datetime.strptime(end_time_str, "%H:%M")
            if t2 < t1:
                delta = (t2 + datetime.timedelta(days=1)) - t1
            else:
                delta = t2 - t1
            profile.daily_hours_target = round(delta.total_seconds() / 3600.0, 2)
        except Exception:
            profile.daily_hours_target = 9.00
    else:
        try:
            daily_hours_target = float(request.data.get('daily_hours_target', 9.0))
            if daily_hours_target <= 0 or daily_hours_target > 24:
                raise ValueError()
            profile.daily_hours_target = daily_hours_target
        except ValueError:
            return Response({'error': 'Daily target must be a number between 0 and 24.'}, status=status.HTTP_400_BAD_REQUEST)

    work_days_list = request.data.get('work_days', [])
    profile.work_days = ",".join(work_days_list)
    profile.save()

    serializer = UserSerializer(request.user)
    return Response({'status': 'success', 'user': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    user = request.user
    user.delete()
    return Response({'status': 'success', 'message': 'Account deleted successfully.'})

@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({'error': 'This email address is not registered.'}, status=status.HTTP_400_BAD_REQUEST)

    otp = str(random.randint(100000, 999999))
    profile = user.profile
    profile.otp_code = otp
    profile.otp_purpose = 'password_reset'
    profile.save()

    mail_subject = 'Tyqro Password Reset Code'
    message = f"Hi {user.first_name},\n\nYour 6-digit password reset verification code is:\n\n{otp}\n\nThanks!"
    email_msg = EmailMessage(mail_subject, message, to=[email])
    send_email_async(email_msg)

    return Response({'status': 'success', 'email': email})

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    email = request.data.get('email', '').strip().lower()
    entered_otp = request.data.get('otp', '').strip()
    new_password = request.data.get('new_password', '')

    if not (email and entered_otp and new_password):
        return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email)
        profile = user.profile
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_400_BAD_REQUEST)

    if profile.otp_code == entered_otp and profile.otp_purpose == 'password_reset':
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        profile.otp_code = None
        profile.otp_purpose = None
        profile.save()

        return Response({'status': 'success', 'message': 'Password has been reset successfully.'})
    else:
        return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)
