document.addEventListener('DOMContentLoaded', () => {
    // === Preloaded Dashboard Data ===
    const embedEl = document.getElementById('dashboard-data');
    let initialData = null;
    if (embedEl) {
        try {
            initialData = JSON.parse(embedEl.textContent);
        } catch (e) {
            console.error("Error parsing initial dashboard data", e);
        }
    }

    // === UI Logic ===
    
    // Set Current Date
    const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDateDisplay').innerText = "Today's Date: " + new Date().toLocaleDateString('en-US', dateOpts);



    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const htmlEl = document.documentElement;
    if (themeToggle) {
        // Init theme from localStorage
        const savedTheme = localStorage.getItem('tyqro-theme') || 'light';
        htmlEl.setAttribute('data-bs-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';

        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlEl.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlEl.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('tyqro-theme', newTheme);
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
    
    // Break Elements
    const breakDisplayContainer = document.getElementById('breakDisplayContainer');
    const breakTimerDisplay = document.getElementById('breakTimerDisplay');
    const netTimerDisplay = document.getElementById('netTimerDisplay');
    const breakCard = document.getElementById('breakCard');
    const netCard = document.getElementById('netCard');
    const breakActionContainer = document.getElementById('breakActionContainer');
    const breakBtn = document.getElementById('breakBtn');

    let timerInterval = null;
    let workStartTime = null;
    
    // Break states
    let totalBreakSeconds = 0;
    let currentBreakStart = null;
    let isBreakActive = false;
    let breakInterval = null;
    
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
        
        // 1. Total Work Time (always runs, does not stop on break)
        let diffTotal = now - workStartTime;
        if (diffTotal < 0) diffTotal = 0;
        
        const totalHrs = Math.floor(diffTotal / 3600000);
        const totalMins = Math.floor((diffTotal % 3600000) / 60000);
        const totalSecs = Math.floor((diffTotal % 60000) / 1000);
        
        timerDisplay.innerText = 
            String(totalHrs).padStart(2, '0') + ':' + 
            String(totalMins).padStart(2, '0') + ':' + 
            String(totalSecs).padStart(2, '0');

        // 2. Net Work Time (Total Work Time - Break Time)
        let totalBreakMs = totalBreakSeconds * 1000;
        if (currentBreakStart) {
            totalBreakMs += (now - currentBreakStart);
        }
        if (totalBreakMs < 0) totalBreakMs = 0;

        let diffNet = diffTotal - totalBreakMs;
        if (diffNet < 0) diffNet = 0;

        const netHrs = Math.floor(diffNet / 3600000);
        const netMins = Math.floor((diffNet % 3600000) / 60000);
        const netSecs = Math.floor((diffNet % 60000) / 1000);

        if (netTimerDisplay) {
            netTimerDisplay.innerText = 
                String(netHrs).padStart(2, '0') + ':' + 
                String(netMins).padStart(2, '0') + ':' + 
                String(netSecs).padStart(2, '0');
        }
    };

    const updateBreakDisplay = () => {
        let totalElapsedMs = totalBreakSeconds * 1000;
        if (currentBreakStart) {
            const now = new Date();
            totalElapsedMs += (now - currentBreakStart);
        }
        if (totalElapsedMs < 0) totalElapsedMs = 0;
        
        const hrs = Math.floor(totalElapsedMs / 3600000);
        const mins = Math.floor((totalElapsedMs % 3600000) / 60000);
        const secs = Math.floor((totalElapsedMs % 60000) / 1000);
        
        if (breakTimerDisplay) {
            breakTimerDisplay.innerText = 
                String(hrs).padStart(2, '0') + ':' + 
                String(mins).padStart(2, '0') + ':' + 
                String(secs).padStart(2, '0');
        }
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

    const startTimer = (startTimeISO, totalBreakDurationSeconds = 0, currentBreakStartISO = null) => {
        workStartTime = new Date(startTimeISO);
        totalBreakSeconds = totalBreakDurationSeconds;
        currentBreakStart = currentBreakStartISO ? new Date(currentBreakStartISO) : null;
        
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay();
        
        // Show break controls
        if (breakActionContainer) breakActionContainer.classList.remove('d-none');
        if (breakDisplayContainer) breakDisplayContainer.classList.remove('d-none');
        
        // Setup initial break button and state
        if (currentBreakStart) {
            isBreakActive = true;
            if (breakBtn) {
                breakBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume Work';
                breakBtn.className = 'btn btn-success w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2';
            }
            if (breakInterval) clearInterval(breakInterval);
            breakInterval = setInterval(updateBreakDisplay, 1000);
            updateBreakDisplay();
            // Highlight Break, dim Net Work
            if (breakCard) breakCard.style.opacity = '1';
            if (netCard) netCard.style.opacity = '0.5';
            // Ensure main timer is highlighted
            timerDisplay.classList.remove('text-muted');
            timerDisplay.classList.add('text-primary');
        } else {
            isBreakActive = false;
            if (breakBtn) {
                breakBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Go on Break';
                breakBtn.className = 'btn btn-warning w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2';
            }
            updateBreakDisplay();
            // Highlight Net Work, dim Break
            if (breakCard) breakCard.style.opacity = '0.5';
            if (netCard) netCard.style.opacity = '1';
            // Ensure main timer is highlighted
            timerDisplay.classList.remove('text-muted');
            timerDisplay.classList.add('text-primary');
        }
        
        startWorkBtn.disabled = true;
        endWorkBtn.disabled = false;
        disableTodoInput();
        renderTodos();
        
        // Auto-end check
        checkAutoEnd();
    };

    const stopTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        if (breakInterval) clearInterval(breakInterval);
        workStartTime = null;
        totalBreakSeconds = 0;
        currentBreakStart = null;
        isBreakActive = false;
        
        // Hide break controls
        if (breakActionContainer) breakActionContainer.classList.add('d-none');
        if (breakDisplayContainer) breakDisplayContainer.classList.add('d-none');
        
        startWorkBtn.disabled = true;
        endWorkBtn.disabled = true;
        disableTodoInput();
        renderTodos();
    };

    const submitStartWork = (reason = null) => {
        const payload = reason ? { late_reason: reason } : null;
        fetchAPI('/attendance/start/', 'POST', payload).then(res => {
            if (res.status === 'success') {
                startTimer(res.start_time, 0, null);
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

    // Fetch initial status (preloaded or fallback)
    if (startWorkBtn) {
        if (initialData && initialData.attendance) {
            const res = initialData.attendance;
            if (res.is_active && res.start_time) {
                startTimer(res.start_time, res.total_break_duration || 0, res.current_break_start);
            } else if (res.end_time) {
                // Already worked today
                timerDisplay.innerText = "Done for today";
                startWorkBtn.disabled = true;
                endWorkBtn.disabled = true;
                disableTodoInput();
                renderTodos();
            }
        } else {
            fetchAPI('/attendance/status/').then(res => {
                if (res.is_active && res.start_time) {
                    startTimer(res.start_time, res.total_break_duration || 0, res.current_break_start);
                } else if (res.end_time) {
                    // Already worked today
                    timerDisplay.innerText = "Done for today";
                    startWorkBtn.disabled = true;
                    endWorkBtn.disabled = true;
                    disableTodoInput();
                    renderTodos();
                }
            });
        }

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

        if (breakBtn) {
            breakBtn.addEventListener('click', () => {
                if (!isBreakActive) {
                    // Go on break
                    fetchAPI('/attendance/start-break/', 'POST').then(res => {
                        if (res.status === 'success') {
                            currentBreakStart = new Date(res.current_break_start);
                            totalBreakSeconds = res.total_break_duration;
                            isBreakActive = true;
                            
                            breakBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume Work';
                            breakBtn.className = 'btn btn-success w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2';
                            
                            if (breakInterval) clearInterval(breakInterval);
                            breakInterval = setInterval(updateBreakDisplay, 1000);
                            updateBreakDisplay();
                            
                            // Highlight Break, dim Net Work
                            if (breakCard) breakCard.style.opacity = '1';
                            if (netCard) netCard.style.opacity = '0.5';
                            // Ensure main timer is highlighted
                            timerDisplay.classList.remove('text-muted');
                            timerDisplay.classList.add('text-primary');
                            updateTimerDisplay(); // immediate update
                            
                            showToast('You are now on break.');
                        } else {
                            showToast(res.message || 'Error starting break', true);
                        }
                    });
                } else {
                    // Resume work
                    fetchAPI('/attendance/end-break/', 'POST').then(res => {
                        if (res.status === 'success') {
                            currentBreakStart = null;
                            totalBreakSeconds = res.total_break_duration;
                            isBreakActive = false;
                            
                            breakBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Go on Break';
                            breakBtn.className = 'btn btn-warning w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2';
                            
                            if (breakInterval) clearInterval(breakInterval);
                            updateBreakDisplay(); // immediate update to show paused value
                            
                            // Highlight Net Work, dim Break
                            if (breakCard) breakCard.style.opacity = '0.5';
                            if (netCard) netCard.style.opacity = '1';
                            // Ensure main timer is highlighted
                            timerDisplay.classList.remove('text-muted');
                            timerDisplay.classList.add('text-primary');
                            updateTimerDisplay(); // immediate update
                            
                            showToast('Work session resumed.');
                        } else {
                            showToast(res.message || 'Error ending break', true);
                        }
                    });
                }
            });
        }
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
        
        const isSessionActive = workStartTime !== null;
        const isSessionEnded = startWorkBtn && startWorkBtn.disabled && endWorkBtn && endWorkBtn.disabled;
        
        let completed = 0;
        todos.forEach(todo => {
            if (todo.is_completed) completed++;
            
            const div = document.createElement('div');
            div.className = 'todo-item d-flex align-items-center justify-content-between p-3 mb-2 border';
            
            const checkboxDisabledAttr = isSessionActive ? '' : 'disabled';
            const deleteDisabledAttr = isSessionEnded ? 'disabled style="pointer-events: none; opacity: 0.5;"' : '';
            
            div.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <input class="form-check-input todo-checkbox m-0" type="checkbox" ${todo.is_completed ? 'checked' : ''} ${checkboxDisabledAttr} data-id="${todo.id}">
                    <span class="todo-text fw-medium ${todo.is_completed ? 'completed' : ''}">${todo.title}</span>
                </div>
                <button class="btn btn-link text-danger p-0 delete-todo" ${deleteDisabledAttr} data-id="${todo.id}"><i class="bi bi-trash"></i></button>
            `;
            todoListEl.appendChild(div);
        });
        todoProgress.innerText = `${completed}/${todos.length}`;

        // Listeners
        document.querySelectorAll('.todo-checkbox:not([disabled])').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                toggleTodo(id);
            });
        });
        document.querySelectorAll('.delete-todo:not([disabled])').forEach(btn => {
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
        if (initialData && initialData.todos) {
            todos = initialData.todos;
            renderTodos();
        } else {
            loadTodos();
        }
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
                showToast("Tyqro Reminder: Your work session has not started yet.");
                // Also trigger browser notification if permission granted
                if (Notification.permission === "granted") {
                    new Notification("Tyqro Reminder", { body: "Your work session has not started yet." });
                } else if (Notification.permission !== "denied") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            new Notification("Tyqro Reminder", { body: "Your work session has not started yet." });
                        }
                    });
                }
                localStorage.setItem('reminder_date', todayStr);
            }
        }

        // 6 PM Auto End
        if (hrs === 18 && mins === 0 && workStartTime) {
             const lastAutoEnded = localStorage.getItem('auto_end_date');
             const todayStr = now.toDateString();
             if (lastAutoEnded !== todayStr) {
                 fetchAPI('/attendance/end/', 'POST').then(res => {
                     if (res.status === 'success') {
                         stopTimer();
                         timerDisplay.innerText = "Session Ended";
                         showToast("Your work session has been automatically ended at 6:00 PM.");

                         // Clear all todos on frontend when session is ended
                         todos = [];
                         renderTodos();

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
