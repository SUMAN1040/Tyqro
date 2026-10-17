from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_work, name='start_work'),
    path('end/', views.end_work, name='end_work'),
    path('status/', views.attendance_status, name='attendance_status'),
    path('start-break/', views.start_break, name='start_break'),
    path('end-break/', views.end_break, name='end_break'),
    path('summary/', views.daily_work_summary, name='daily_work_summary'),
    path('verify/<str:report_id>/', views.verify_report_public, name='verify_report_public'),
]

