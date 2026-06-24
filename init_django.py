import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tyqro.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(["manage.py", "startproject", "tyqro", "."])
    execute_from_command_line(["manage.py", "startapp", "users"])
    execute_from_command_line(["manage.py", "startapp", "attendance"])
    execute_from_command_line(["manage.py", "startapp", "todos"])
    execute_from_command_line(["manage.py", "startapp", "analytics"])
    execute_from_command_line(["manage.py", "startapp", "notifications"])

if __name__ == '__main__':
    main()
