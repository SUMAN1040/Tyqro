from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from .forms import UserSignupForm, EmailAuthenticationForm
from django.contrib import messages
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from django.contrib.auth.models import User

import random
import json
from django.utils import timezone
from todos.models import Todo
from attendance.models import Attendance
from analytics.models import DailyPerformance

def landing_page(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'landing.html')

@login_required
def dashboard(request):
    # Fetch initial data for dashboard
    today = timezone.now().date()
    
    # 1. Todos
    todos_qs = Todo.objects.filter(user=request.user, date=today).order_by('created_at').values('id', 'title', 'is_completed')
    todos = list(todos_qs)
    
    # 2. Attendance
    try:
        attendance = Attendance.objects.get(user=request.user, date=today)
        attendance_status = {
            'is_active': attendance.is_active,
            'start_time': attendance.start_time.isoformat() if attendance.start_time else None,
            'end_time': attendance.end_time.isoformat() if attendance.end_time else None,
            'total_break_duration': attendance.total_break_duration.total_seconds(),
            'current_break_start': attendance.current_break_start.isoformat() if attendance.current_break_start else None
        }
    except Attendance.DoesNotExist:
        attendance_status = {
            'is_active': False,
            'start_time': None,
            'end_time': None,
            'total_break_duration': 0,
            'current_break_start': None
        }
        
    # 3. Heatmap / Analytics
    now = timezone.now()
    current_year = now.year
    start_year = request.user.date_joined.year if request.user.date_joined else current_year
    available_years = list(range(current_year, start_year - 1, -1))
    if current_year not in available_years:
        available_years.insert(0, current_year)
        
    import datetime
    start_date = datetime.date(current_year, 1, 1)
    end_date = datetime.date(current_year, 12, 31)
    performances = DailyPerformance.objects.filter(user=request.user, date__range=(start_date, end_date))
    from django.db.models import Count, Q
    year_todos = Todo.objects.filter(user=request.user, date__range=(start_date, end_date)) \
        .values('date') \
        .annotate(
            total=Count('id'),
            completed=Count('id', filter=Q(is_completed=True))
        )

    data_map = {}
    for perf in performances:
        date_str = perf.date.isoformat()
        data_map[date_str] = {
            'date': date_str,
            'hours': float(perf.hours_worked),
            'tasks_completed': 0,
            'total_tasks': 0
        }
        
    for item in year_todos:
        date_str = item['date'].isoformat()
        if date_str not in data_map:
            data_map[date_str] = {
                'date': date_str,
                'hours': 0.0,
                'tasks_completed': 0,
                'total_tasks': 0
            }
        data_map[date_str]['total_tasks'] = item['total']
        data_map[date_str]['tasks_completed'] = item['completed']

    analytics = {
        'status': 'success',
        'data': list(data_map.values()),
        'years': available_years,
        'selected_year': current_year
    }

    # Combined payload
    payload = {
        'todos': todos,
        'attendance': attendance_status,
        'analytics': analytics
    }
    
    return render(request, 'dashboard.html', {'dashboard_data_json': json.dumps(payload)})

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        form = EmailAuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('dashboard')
    else:
        form = EmailAuthenticationForm()
    return render(request, 'login.html', {'form': form})

def logout_view(request):
    if request.method == 'POST':
        logout(request)
        return redirect('login')
    return redirect('dashboard')

def signup_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        form = UserSignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            
            otp = str(random.randint(100000, 999999))
            request.session['signup_otp'] = otp
            request.session['signup_user_id'] = user.id
            
            mail_subject = 'Your Tyqro Verification Code'
            message = f"Hi {user.first_name},\n\nThank you for signing up for Tyqro. Your 6-digit email verification code is:\n\n{otp}\n\nPlease enter this code on the verification page to activate your account.\nIf you did not sign up for an account, please ignore this email.\n\nThanks!"
            to_email = form.cleaned_data.get('email')
            email = EmailMessage(
                        mail_subject, message, to=[to_email]
            )
            email.send()
            return redirect('verify_otp')
    else:
        form = UserSignupForm()
    return render(request, 'signup.html', {'form': form})

def verify_otp(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    user_id = request.session.get('signup_user_id')
    stored_otp = request.session.get('signup_otp')
    
    if not user_id or not stored_otp:
        messages.error(request, 'Verification session expired. Please sign up again.')
        return redirect('signup')
        
    if request.method == 'POST':
        entered_otp = request.POST.get('otp', '').strip()
        if entered_otp == stored_otp:
            user = User.objects.get(id=user_id)
            user.is_active = True
            user.save()
            
            del request.session['signup_otp']
            del request.session['signup_user_id']
            
            messages.success(request, 'Account verified successfully!')
            login(request, user, backend='users.backends.EmailBackend')
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid OTP. Please try again.')
            
    return render(request, 'verify_otp.html', {'email': User.objects.get(id=user_id).email})

@login_required
def update_profile(request):
    if request.method == 'POST':
        user = request.user
        
        # Update name
        user.first_name = request.POST.get('first_name', '').strip()
        user.last_name = request.POST.get('last_name', '').strip()
        user.save()
        
        # Handle avatar upload
        avatar = request.FILES.get('avatar')
        if avatar:
            if avatar.size > 100 * 1024:
                messages.error(request, 'Profile image must be less than 100KB.')
                return redirect('dashboard')
            user.profile.avatar = avatar
            user.profile.save()
            
        # Handle email change with OTP
        new_email = request.POST.get('email', '').strip()
        if new_email and new_email != user.email:
            if User.objects.filter(email=new_email).exclude(id=user.id).exists():
                messages.error(request, 'This email is already in use.')
                return redirect('dashboard')
                
            otp = str(random.randint(100000, 999999))
            request.session['update_email_otp'] = otp
            request.session['update_email_pending'] = new_email
            
            mail_subject = 'Verify Your New Email Address'
            message = f"Hi {user.first_name},\n\nWe received a request to update the email address associated with your Tyqro profile. Please confirm this change by entering the verification code below.\n\nYour 6-digit verification code is:\n\n{otp}\n\nIf you did not initiate this request, please ignore this email.\n\nThanks!"
            email = EmailMessage(mail_subject, message, to=[new_email])
            email.send()
            return redirect('verify_email_update')
            
        messages.success(request, 'Profile updated successfully!')
    return redirect('dashboard')

@login_required
def verify_email_update(request):
    pending_email = request.session.get('update_email_pending')
    stored_otp = request.session.get('update_email_otp')
    
    if not pending_email or not stored_otp:
        messages.error(request, 'Verification session expired.')
        return redirect('dashboard')
        
    if request.method == 'POST':
        entered_otp = request.POST.get('otp', '').strip()
        if entered_otp == stored_otp:
            user = request.user
            user.email = pending_email
            user.username = pending_email 
            user.save()
            
            del request.session['update_email_otp']
            del request.session['update_email_pending']
            
            messages.success(request, 'Email updated successfully!')
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid OTP. Please try again.')
            
    return render(request, 'verify_email_update.html', {'email': pending_email})

def forgot_password(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        if not email:
            messages.error(request, 'Please enter your email address.')
            return redirect('forgot_password')
            
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # We still show a generic message to prevent email enumeration
            messages.success(request, 'If an account with that email exists, we have sent a verification code.')
            return redirect('login')
            
        otp = str(random.randint(100000, 999999))
        request.session['reset_otp'] = otp
        request.session['reset_email'] = email
        
        mail_subject = 'Tyqro Password Reset Code'
        message = f"Hi {user.first_name},\n\nA request was made to reset the password for your Tyqro account. Use the authorization code below to complete the reset.\n\nYour 6-digit password reset code is:\n\n{otp}\n\nIf you did not initiate this request, please ignore this email.\n\nThanks!"
        email_msg = EmailMessage(
                    mail_subject, message, to=[email]
        )
        email_msg.send()
        return redirect('forgot_password_verify')
        
    return render(request, 'forgot_password.html')

def forgot_password_verify(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    email = request.session.get('reset_email')
    stored_otp = request.session.get('reset_otp')
    
    if not email or not stored_otp:
        messages.error(request, 'Password reset session expired. Please try again.')
        return redirect('forgot_password')
        
    if request.method == 'POST':
        entered_otp = request.POST.get('otp', '').strip()
        if entered_otp == stored_otp:
            request.session['can_reset_password'] = True
            return redirect('reset_password')
        else:
            messages.error(request, 'Invalid verification code. Please try again.')
            
    return render(request, 'forgot_password_verify.html', {'email': email})

def reset_password(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    email = request.session.get('reset_email')
    can_reset = request.session.get('can_reset_password')
    
    if not email or not can_reset:
        messages.error(request, 'Unauthorized access to password reset.')
        return redirect('forgot_password')
        
    if request.method == 'POST':
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
        
        if not password or not confirm_password:
            messages.error(request, 'Please fill in both fields.')
        elif password != confirm_password:
            messages.error(request, 'Passwords do not match.')
        elif len(password) < 8:
            messages.error(request, 'Password must be at least 8 characters long.')
        else:
            try:
                user = User.objects.get(email=email)
                
                # Check Django validation rules
                from django.contrib.auth.password_validation import validate_password
                from django.core.exceptions import ValidationError
                try:
                    validate_password(password, user)
                except ValidationError as e:
                    for error in e.messages:
                        messages.error(request, error)
                    return render(request, 'reset_password.html')

                user.set_password(password)
                user.save()
                
                # Clean up session
                del request.session['reset_otp']
                del request.session['reset_email']
                del request.session['can_reset_password']
                
                messages.success(request, 'Password has been reset successfully! You can now log in.')
                return redirect('login')
            except User.DoesNotExist:
                messages.error(request, 'User not found.')
                return redirect('forgot_password')
                
    return render(request, 'reset_password.html')
