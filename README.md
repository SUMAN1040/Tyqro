# WorkLog

WorkLog is a modern productivity and attendance tracking web application, designed with a clean, Notion/Linear-inspired interface. It helps users manage their daily tasks while maintaining a robust, live-updating log of their work hours and performance.

## Features

- **Authentication System**: Secure user registration, login, and session management.
- **Dynamic Dashboard**: A sleek, dark-themed dashboard built with Bootstrap 5 and custom CSS styling.
- **Attendance Tracking**: A live work timer that persists seamlessly across browser reloads and sessions.
- **Task Management (Todos)**: Fully AJAX-driven Todo list supporting seamless creation, toggling, and deletion without page reloads.
- **Performance Heatmap**: A GitHub-style contribution graph utilizing Chart.js to visualize daily performance, active hours, and points earned throughout the year. It includes a dynamic year-selection filter.
- **Smart Automation**: Client-side monitoring for auto-ending sessions at 5:00 PM and browser notifications for start-of-day reminders at 9:00 AM.

## Tech Stack

- **Backend**: Django 5.x (Python)
- **Database**: SQLite3 (Default)
- **Frontend**: HTML5, Vanilla JavaScript, Bootstrap 5, Custom CSS
- **Data Visualization**: Chart.js

## Local Setup Instructions

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd WorkLog
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies**:
   *(Assuming standard Django requirements)*
   ```bash
   pip install django
   ```

4. **Apply Database Migrations**:
   ```bash
   python manage.py migrate
   ```

5. **Create a Superuser** (to access the Django Admin panel):
   ```bash
   python manage.py createsuperuser
   ```

6. **Run the Development Server**:
   ```bash
   python manage.py runserver
   ```

7. **Access the App**:
   Open your browser and navigate to `http://127.0.0.1:8000/`.

## Application Structure

- `users/`: Handles all custom authentication and user management views.
- `attendance/`: Manages the live timer, clock-in/out logic, and saves sessions to the database.
- `todos/`: Handles the AJAX-based CRUD operations for user tasks.
- `analytics/`: Aggregates user performance data and serves it to the frontend heatmap.
- `notifications/`: Infrastructure for handling web push notifications and daily reminders.
