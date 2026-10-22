from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from todos.models import Todo
from attendance.models import Attendance

class TodoApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser@example.com',
            email='testuser@example.com',
            password='Password123!',
            first_name='Test',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)
        self.today = timezone.now().date()

    def test_add_todo_success(self):
        response = self.client.post('/api/todos/add/', {'title': 'Finish Q3 Report'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['todo']['title'], 'Finish Q3 Report')
        self.assertTrue(Todo.objects.filter(user=self.user, title='Finish Q3 Report').exists())

    def test_add_todo_validation(self):
        # Empty title
        res_empty = self.client.post('/api/todos/add/', {'title': '   '})
        self.assertEqual(res_empty.status_code, status.HTTP_400_BAD_REQUEST)

        # Title exceeding 255 chars
        long_title = 'A' * 256
        res_long = self.client.post('/api/todos/add/', {'title': long_title})
        self.assertEqual(res_long.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_todo_blocked_after_work_starts(self):
        Attendance.objects.create(user=self.user, date=self.today, start_time=timezone.now(), is_active=True)
        response = self.client.post('/api/todos/add/', {'title': 'New Task'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cannot add tasks after starting work', response.data['error'])

    def test_edit_todo_success(self):
        todo = Todo.objects.create(user=self.user, title='Original Title', date=self.today)
        response = self.client.post(f'/api/todos/edit/{todo.id}/', {'title': 'Updated Title'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertEqual(todo.title, 'Updated Title')

    def test_delete_todo_date_protection(self):
        # Todo created before work starts
        todo = Todo.objects.create(user=self.user, title='Task to Delete', date=self.today)
        
        # Start work
        Attendance.objects.create(user=self.user, date=self.today, start_time=timezone.now(), is_active=True)
        
        # Attempting to delete should now be blocked
        response = self.client.delete(f'/api/todos/delete/{todo.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Todo.objects.filter(id=todo.id).exists())

    def test_toggle_todo_completion_and_timer_pause(self):
        # Active attendance required to toggle
        Attendance.objects.create(user=self.user, date=self.today, start_time=timezone.now(), is_active=True)
        todo = Todo.objects.create(
            user=self.user,
            title='Timed Task',
            date=self.today,
            timer_started_at=timezone.now()
        )
        
        response = self.client.post(f'/api/todos/toggle/{todo.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertTrue(todo.is_completed)
        self.assertIsNone(todo.timer_started_at)
