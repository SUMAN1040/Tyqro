document.addEventListener('DOMContentLoaded', () => {
    // === UI Logic ===
    
    // Set Current Date
    const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDateDisplay').innerText = "Today's Date: " + new Date().toLocaleDateString('en-US', dateOpts);



    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const htmlEl = document.documentElement;
    if (themeToggle) {
        // Init theme from localStorage
        const savedTheme = localStorage.getItem('worklog-theme') || 'light';
        htmlEl.setAttribute('data-bs-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';

        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlEl.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlEl.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('worklog-theme', newTheme);
            themeToggle.innerHTML = newTheme === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
        });
    }

    // Toast Utility
    const toastEl = document.getElementById('appToast');
    const toastBody = document.getElementById('toastMessage');
    let toastObj = null;
    if (toastEl) {
        toastObj = new bootstrap.Toast(toastEl);
    }
    const showToast = (message, isError = false) => {
        if (!toastObj) return;
        toastBody.innerText = message;
        toastEl.className = `toast align-items-center border-0 ${isError ? 'text-bg-danger' : 'text-bg-primary'}`;
        toastObj.show();
    };

    // Helper fetch with CSRF
    const fetchAPI = async (url, method = 'GET', body = null) => {
        const options = {
            method,
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        return response.json();
    };

    // Avatar Upload Validation
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                if (this.files[0].size > 300 * 1024) { // 300KB
                    showToast('Profile image must be less than 300KB.', true);
                    this.value = ''; // clear input
                }
            }
        });
    }

    // === Attendance & Timer Logic ===
    const startWorkBtn = document.getElementById('startWorkBtn');
    const endWorkBtn = document.getElementById('endWorkBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    let timerInterval = null;
    let workStartTime = null;
    
    // Modal Elements
    const reasonModalEl = document.getElementById('reasonModal');
    let reasonModal = null;
    if (reasonModalEl) reasonModal = new bootstrap.Modal(reasonModalEl);
    const reasonTextarea = document.getElementById('reasonTextarea');
    const reasonSubmitBtn = document.getElementById('reasonSubmitBtn');
    const wordCountDisplay = document.getElementById('wordCountDisplay');
    const reasonModalLabel = document.getElementById('reasonModalLabel');
    const reasonModalDesc = document.getElementById('reasonModalDesc');
    
    let currentAction = null; // 'start' or 'end'

    if (reasonTextarea) {
        reasonTextarea.addEventListener('input', () => {
            const text = reasonTextarea.value.trim();
            const words = text ? text.split(/\s+/).length : 0;
            wordCountDisplay.innerText = `${words} / 15 words`;
            if (words >= 15) {
                wordCountDisplay.classList.remove('text-danger', 'text-muted');
                wordCountDisplay.classList.add('text-success');
                reasonSubmitBtn.disabled = false;
            } else {
                wordCountDisplay.classList.remove('text-success', 'text-muted');
                wordCountDisplay.classList.add('text-danger');
                reasonSubmitBtn.disabled = true;
            }
        });
        
        reasonSubmitBtn.addEventListener('click', () => {
            const reason = reasonTextarea.value.trim();
            if (currentAction === 'start') {
                submitStartWork(reason);
            } else if (currentAction === 'end') {
                submitEndWork(reason);
            }
            reasonModal.hide();
        });
    }

    const updateTimerDisplay = () => {
        if (!workStartTime) return;
        const now = new Date();
        const diff = now - workStartTime; // ms
        
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        
        timerDisplay.innerText = 
            String(hrs).padStart(2, '0') + ':' + 
            String(mins).padStart(2, '0') + ':' + 
            String(secs).padStart(2, '0');
    };

    const disableTodoInput = () => {
        const newTodoInput = document.getElementById('newTodoInput');
        const addTodoBtn = document.getElementById('addTodoBtn');
        if (newTodoInput) {
            newTodoInput.disabled = true;
            newTodoInput.placeholder = "Tasks must be added before starting work";
        }
        if (addTodoBtn) {
            addTodoBtn.disabled = true;
        }
    };

    const startTimer = (startTimeISO) => {
        workStartTime = new Date(startTimeISO);
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay();
        startWorkBtn.disabled = true;
        endWorkBtn.disabled = false;
        disableTodoInput();
        
        // Auto-end check
        checkAutoEnd();
    };

    const stopTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        workStartTime = null;
        startWorkBtn.disabled = true;
        endWorkBtn.disabled = true;
        disableTodoInput();
    };

    const submitStartWork = (reason = null) => {
        const payload = reason ? { late_reason: reason } : null;
        fetchAPI('/attendance/start/', 'POST', payload).then(res => {
            if (res.status === 'success') {
                startTimer(res.start_time);
                showToast('Work session started!');
            } else {
                showToast(res.message || 'Error starting work', true);
            }
        });
    };

    const submitEndWork = (reason = null) => {
        const payload = reason ? { early_leave_reason: reason } : null;
        fetchAPI('/attendance/end/', 'POST', payload).then(res => {
            if (res.status === 'success') {
                stopTimer();
                timerDisplay.innerText = "Session Ended";
                showToast('Work session ended successfully!');
                if (typeof loadHeatmap === 'function') loadHeatmap(); // refresh charts
            } else {
                showToast(res.message || 'Error ending work', true);
            }
        });
    };

    // Fetch initial status
    if (startWorkBtn) {
        fetchAPI('/attendance/status/').then(res => {
            if (res.is_active && res.start_time) {
                startTimer(res.start_time);
            } else if (res.end_time) {
                // Already worked today
                timerDisplay.innerText = "Done for today";
                startWorkBtn.disabled = true;
                endWorkBtn.disabled = true;
                disableTodoInput();
            }
        });

        startWorkBtn.addEventListener('click', () => {
            const confirmed = confirm("Have you added all your tasks for today? You won't be able to add more after starting work.");
            if (!confirmed) return;

            const now = new Date();
            const hrs = now.getHours();
            const mins = now.getMinutes();
            // Start after 9:05 AM (hrs > 9 or hrs == 9 and mins > 5)
            if (hrs > 9 || (hrs === 9 && mins > 5)) {
                currentAction = 'start';
                reasonModalLabel.innerText = "Late Start Reason";
                reasonModalDesc.innerText = "You are starting work after 9:05 AM. Please provide a reason. Minimum 15 words required.";
                reasonTextarea.value = '';
                reasonTextarea.dispatchEvent(new Event('input')); // trigger word count validation
                reasonModal.show();
            } else {
                submitStartWork();
            }
        });

        endWorkBtn.addEventListener('click', () => {
            const now = new Date();
            const hrs = now.getHours();
            // End before 6:00 PM (18:00)
            if (hrs < 18) {
                currentAction = 'end';
                reasonModalLabel.innerText = "Early Leave Reason";
                reasonModalDesc.innerText = "You are ending work before 6:00 PM. Please provide a reason. Minimum 15 words required.";
                reasonTextarea.value = '';
                reasonTextarea.dispatchEvent(new Event('input')); // trigger word count validation
                reasonModal.show();
            } else {
                submitEndWork();
            }
        });
    }


    // === Todo Logic ===
    const todoListEl = document.getElementById('todoList');
    const newTodoInput = document.getElementById('newTodoInput');
    const addTodoBtn = document.getElementById('addTodoBtn');
    const emptyTodoState = document.getElementById('emptyTodoState');
    const todoProgress = document.getElementById('todoProgress');

    let todos = [];

    const renderTodos = () => {
        if (!todoListEl) return;
        todoListEl.innerHTML = '';
        if (todos.length === 0) {
            if (emptyTodoState) todoListEl.appendChild(emptyTodoState);
            todoProgress.innerText = `0/0`;
            return;
        }
        
        let completed = 0;
        todos.forEach(todo => {
            if (todo.is_completed) completed++;
            
            const div = document.createElement('div');
            div.className = 'todo-item d-flex align-items-center justify-content-between p-3 mb-2 border';
            
            div.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <input class="form-check-input todo-checkbox m-0" type="checkbox" ${todo.is_completed ? 'checked' : ''} data-id="${todo.id}">
                    <span class="todo-text fw-medium ${todo.is_completed ? 'completed' : ''}">${todo.title}</span>
                </div>
                <button class="btn btn-link text-danger p-0 delete-todo" data-id="${todo.id}"><i class="bi bi-trash"></i></button>
            `;
            todoListEl.appendChild(div);
        });
        todoProgress.innerText = `${completed}/${todos.length}`;

        // Listeners
        document.querySelectorAll('.todo-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                toggleTodo(id);
            });
        });
        document.querySelectorAll('.delete-todo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                deleteTodo(id);
            });
        });
    };

    const loadTodos = () => {
        if (!todoListEl) return;
        fetchAPI('/todos/list/').then(res => {
            if (res.todos) {
                todos = res.todos;
                renderTodos();
            }
        });
    };

    const toggleTodo = (id) => {
        fetchAPI(`/todos/toggle/${id}/`, 'POST').then(res => {
            if (res.status === 'success') {
                const todo = todos.find(t => t.id == id);
                if (todo) todo.is_completed = res.is_completed;
                renderTodos();
            }
        });
    };

    const deleteTodo = (id) => {
        fetchAPI(`/todos/delete/${id}/`, 'POST').then(res => {
            if (res.status === 'success') {
                todos = todos.filter(t => t.id != id);
                renderTodos();
            }
        });
    };

    if (addTodoBtn) {
        loadTodos();
        addTodoBtn.addEventListener('click', () => {
            const title = newTodoInput.value.trim();
            if (title) {
                fetchAPI('/todos/add/', 'POST', { title }).then(res => {
                    if (res.status === 'success') {
                        todos.push(res.todo);
                        newTodoInput.value = '';
                        renderTodos();
                    }
                });
            }
        });
        newTodoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodoBtn.click();
        });
    }

    // === Auto-Schedule Logic ===
    const checkSchedule = () => {
        const now = new Date();
        const hrs = now.getHours();
        const mins = now.getMinutes();

        // 9 AM Reminder
        if (hrs === 9 && mins === 0 && !workStartTime) {
            // Check if already notified today using localStorage
            const lastNotified = localStorage.getItem('reminder_date');
            const todayStr = now.toDateString();
            if (lastNotified !== todayStr) {
                showToast("WorkLog Reminder: Your work session has not started yet.");
                // Also trigger browser notification if permission granted
                if (Notification.permission === "granted") {
                    new Notification("WorkLog Reminder", { body: "Your work session has not started yet." });
                } else if (Notification.permission !== "denied") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            new Notification("WorkLog Reminder", { body: "Your work session has not started yet." });
                        }
                    });
                }
                localStorage.setItem('reminder_date', todayStr);
            }
        }

        // 5 PM Auto End
        if (hrs === 17 && mins === 0 && workStartTime) {
             const lastAutoEnded = localStorage.getItem('auto_end_date');
             const todayStr = now.toDateString();
             if (lastAutoEnded !== todayStr) {
                 fetchAPI('/attendance/end/', 'POST').then(res => {
                     if (res.status === 'success') {
                         stopTimer();
                         timerDisplay.innerText = "Session Ended";
                         showToast("Your work session has been automatically ended at 5:00 PM.");
                         localStorage.setItem('auto_end_date', todayStr);
                     }
                 });
             }
        }
    };

    const checkAutoEnd = () => {
        setInterval(checkSchedule, 60000); // Check every minute
        checkSchedule(); // initial check
    };
    
    // If we're on a page with timer, schedule is checked inside startTimer. 
    // If not started, still check for 9 AM
    setInterval(checkSchedule, 60000); 
    checkSchedule();

    // === Analog Clock Logic ===
    const setClock = () => {
        const now = new Date();
        const seconds = now.getSeconds();
        const secondsDegrees = ((seconds / 60) * 360) - 90;
        const secondHand = document.getElementById('secondHand');
        if (secondHand) secondHand.style.transform = `rotate(${secondsDegrees}deg)`;

        const mins = now.getMinutes();
        const minsDegrees = ((mins / 60) * 360) + ((seconds/60)*6) - 90;
        const minHand = document.getElementById('minHand');
        if (minHand) minHand.style.transform = `rotate(${minsDegrees}deg)`;

        const hour = now.getHours();
        const hourDegrees = ((hour / 12) * 360) + ((mins/60)*30) - 90;
        const hourHand = document.getElementById('hourHand');
        if (hourHand) hourHand.style.transform = `rotate(${hourDegrees}deg)`;
    };
    
    // Check if clock exists on the page
    const clockFace = document.querySelector('.clock-face');
    if (clockFace) {
        // Generate markers (12, 3, 6, 9 and dots)
        if (!document.querySelector('.clock-marker')) {
            for (let i = 1; i <= 12; i++) {
                const marker = document.createElement('div');
                marker.className = `clock-marker ${i % 3 === 0 ? 'main-marker' : 'dot-marker'}`;
                
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const radius = i % 3 === 0 ? 38 : 42; // percentage from center
                
                const left = 50 + Math.cos(angle) * radius;
                const top = 50 + Math.sin(angle) * radius;
                
                marker.style.left = `${left}%`;
                marker.style.top = `${top}%`;
                
                if (i % 3 === 0) {
                    marker.innerText = i;
                }
                
                clockFace.appendChild(marker);
            }
        }

        setInterval(setClock, 1000);
        setClock();
    }

});
