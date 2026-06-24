from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from .forms import UserSignupForm, EmailAuthenticationForm
from django.contrib import messages
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from django.contrib.auth.models import User

import random

def landing_page(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'landing.html')

@login_required
def dashboard(request):
    return render(request, 'dashboard.html')

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
            message = render_to_string('verification_email.html', {
                'user': user,
                'otp': otp,
            })
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
            if avatar.size > 300 * 1024:
                messages.error(request, 'Profile image must be less than 300KB.')
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
            message = render_to_string('verification_email.html', {
                'user': user,
                'otp': otp,
            })
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
        message = render_to_string('verification_email.html', {
            'user': user,
            'otp': otp,
            'is_reset': True
        })
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
