from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from . import views
from . import study_views

urlpatterns = [
    # Stateless Simple JWT Auth
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Custom API Endpoints
    path('api/auth/signup/', views.signup_view, name='api_signup'),
    path('api/auth/verify-otp/', views.verify_otp, name='api_verify_otp'),
    path('api/auth/user/', views.current_user, name='api_current_user'),
    path('api/auth/profile/update/', views.update_profile, name='api_update_profile'),
    path('api/auth/profile/verify-email/', views.verify_email_update, name='api_verify_email_update'),
    path('api/auth/profile/change-password/', views.change_password, name='api_change_password'),
    path('api/auth/profile/preferences/', views.update_preferences, name='api_update_preferences'),
    path('api/auth/profile/delete/', views.delete_account, name='api_delete_account'),
    path('api/auth/forgot-password/', views.forgot_password, name='api_forgot_password'),
    path('api/auth/forgot-password/reset/', views.reset_password, name='api_reset_password'),

    # Study / Connected Peers Endpoints
    path('api/study/code/', study_views.get_study_code, name='api_study_code'),
    path('api/study/join/', study_views.join_study_group, name='api_study_join'),
    path('api/study/connect/', study_views.join_study_group, name='api_study_connect'),
    path('api/study/status/', study_views.get_group_status, name='api_study_status'),
    path('api/study/peers/', study_views.get_group_status, name='api_study_peers'),
    path('api/study/leave/', study_views.leave_study_group, name='api_study_leave'),
    path('api/study/remove-member/', study_views.remove_group_member, name='api_study_remove_member'),
    path('api/study/remove-peer/', study_views.remove_group_member, name='api_study_remove_peer'),
    path('api/study/peer/<int:peer_id>/', study_views.get_peer_data, name='api_study_peer_data'),
]