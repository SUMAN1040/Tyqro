from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_work, name='start_work'),
    path('end/', views.end_work, name='end_work'),
    path('status/', views.attendance_status, name='attendance_status'),
]
