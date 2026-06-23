from django.urls import path
from . import views

urlpatterns = [
    path('data/', views.analytics_data, name='analytics_data'),
]
