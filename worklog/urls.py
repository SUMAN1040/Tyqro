from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('users.urls')),
    path('attendance/', include('attendance.urls')),
    path('todos/', include('todos.urls')),
    path('analytics/', include('analytics.urls')),
    path('notifications/', include('notifications.urls')),
]
