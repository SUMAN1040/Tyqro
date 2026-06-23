from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('signup/', views.signup_view, name='signup'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('profile/verify-email/', views.verify_email_update, name='verify_email_update'),
]
