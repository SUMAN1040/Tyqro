import os
from pathlib import Path

apps = ['users', 'attendance', 'todos', 'analytics', 'notifications']
base = Path('.')

for app in apps:
    app_dir = base / app
    app_dir.mkdir(exist_ok=True)
    
    (app_dir / '__init__.py').write_text('# Init')
    
    apps_content = f"""from django.apps import AppConfig

class {app.capitalize()}Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = '{app}'
"""
    (app_dir / 'apps.py').write_text(apps_content)
    (app_dir / 'admin.py').write_text('from django.contrib import admin\n')
    (app_dir / 'models.py').write_text('from django.db import models\n')
    (app_dir / 'views.py').write_text('from django.shortcuts import render\n')
    (app_dir / 'urls.py').write_text('from django.urls import path\nfrom . import views\n\nurlpatterns = []\n')

print("Created app files successfully!")
