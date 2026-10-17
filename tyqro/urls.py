from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from attendance import views as attendance_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('users.urls')),
    path('verify/<str:report_id>/', attendance_views.verify_report_public, name='verify_report_public_root'),
    path('api/attendance/', include('attendance.urls')),
    path('api/todos/', include('todos.urls')),
    path('api/analytics/', include('analytics.urls')),
    path('api/notifications/', include('notifications.urls')),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
