from django.urls import path
from . import views

urlpatterns = [
    path('unread/', views.unread_notifications, name='unread_notifications'),
    path('mark_read/', views.mark_read, name='mark_read'),
]
