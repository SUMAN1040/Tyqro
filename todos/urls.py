from django.urls import path
from . import views

urlpatterns = [
    path('list/', views.todo_list, name='todo_list'),
    path('add/', views.add_todo, name='add_todo'),
    path('edit/<int:todo_id>/', views.edit_todo, name='edit_todo'),
    path('toggle/<int:todo_id>/', views.toggle_todo, name='toggle_todo'),
    path('delete/<int:todo_id>/', views.delete_todo, name='delete_todo'),
    path('start-timer/<int:todo_id>/', views.start_task_timer, name='start_task_timer'),
    path('pause-timer/<int:todo_id>/', views.pause_task_timer, name='pause_task_timer'),
]