from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from .forms import UserSignupForm, EmailAuthenticationForm
from django.contrib import messages
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from django.contrib.auth.models import User

import random

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
            
            mail_subject = 'Your WorkLog Verification Code'
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
