from django.urls import path
from . import views

urlpatterns = [
    path('sw.js', views.service_worker, name='sw.js'),
    path('', views.landing_page, name='landing'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('signup/', views.signup_view, name='signup'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('profile/verify-email/', views.verify_email_update, name='verify_email_update'),
    path('forgot-password/', views.forgot_password, name='forgot_password'),
    path('forgot-password/verify/', views.forgot_password_verify, name='forgot_password_verify'),
    path('forgot-password/reset/', views.reset_password, name='reset_password'),
]