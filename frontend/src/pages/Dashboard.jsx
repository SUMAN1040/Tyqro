import React, { useState, useEffect, useRef } from 'react';
import { API } from '../api';
import GroupStudyModal from '../components/GroupStudyModal';
import GroupStudyPeerPanel from '../components/GroupStudyPeerPanel';

const CLOCK_MARKERS = (() => {
    const list = [];
    for (let i = 1; i <= 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const radius = i % 3 === 0 ? 38 : 42;
        const left = 50 + Math.cos(angle) * radius;
        const top = 50 + Math.sin(angle) * radius;
        list.push({
            value: i,
            isMain: i % 3 === 0,
            style: {
                left: `${left}%`,
                top: `${top}%`
            }
        });
    }
    return list;
})();

export default function Dashboard({ user }) {
    const [currentDate, setCurrentDate] = useState('');
    
    // Timer states
    const [isActive, setIsActive] = useState(false);
    const [isBreak, setIsBreak] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [totalBreakSeconds, setTotalBreakSeconds] = useState(0);
    const [currentBreakStart, setCurrentBreakStart] = useState(null);
    
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [breakSeconds, setBreakSeconds] = useState(0);
    const [netSeconds, setNetSeconds] = useState(0);
    
    // Analog clock hands angles
    const [clockAngles, setClockAngles] = useState({ hour: 0, minute: 0, second: 0 });

    // Todo states
    const [todos, setTodos] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    const pendingDeletesRef = useRef(new Set());
    const pendingTogglesRef = useRef(new Map());

    // Heatmap / Stats states
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [heatmapData, setHeatmapData] = useState([]);
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [dataMap, setDataMap] = useState({});
    const [selectedDateStats, setSelectedDateStats] = useState({ date: 'Today', hours: 0, completed: 0, total: 0 });

    // Group study states
    const [groupStatus, setGroupStatus] = useState({ in_group: false, members: [], count: 0, max_members: 10 });
    const [isSplitView, setIsSplitView] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);

    // Modals & Reason Prompt states
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [reasonType, setReasonType] = useState(''); // 'late' or 'early'
    const [reasonText, setReasonText] = useState('');
    const [reasonError, setReasonError] = useState('');
    const [showConfirmStart, setShowConfirmStart] = useState(false);
    const autoEndAttempted = useRef(false);

    // Fetch Group Status
    const fetchGroupStatus = async () => {
        try {
            const res = await API.get('/api/study/status/');
            setGroupStatus(res.data);
            // If active in a group with other members and split view was never toggled off
            if (res.data.in_group && res.data.members?.length > 1) {
                // Auto-enable split view if user has peers
            }
        } catch (err) {
            console.error('Failed to load group status:', err);
        }
    };

    // Apply attendance status immediately into local state
    const applyAttendanceStatus = (status) => {
        if (!status) return;
        setIsActive(Boolean(status.is_active));
        if (!status.is_active) {
            autoEndAttempted.current = false;
        }
        setStartTime(status.start_time ? new Date(status.start_time) : null);
        setEndTime(status.end_time ? new Date(status.end_time) : null);
        setTotalBreakSeconds(Number(status.total_break_duration) || 0);
        setCurrentBreakStart(status.current_break_start ? new Date(status.current_break_start) : null);
        setIsBreak(Boolean(status.current_break_start));
    };

    // Fetch initial status and todos concurrently
    const fetchStatusAndTodos = async () => {
        try {
            const [statusRes, todosRes] = await Promise.all([
                API.get('/api/attendance/status/'),
                API.get('/api/todos/list/')
            ]);
            applyAttendanceStatus(statusRes.data);
            setTodos(todosRes.data.todos || []);
        } catch (err) {
            console.error('Failed to load status or tasks:', err);
        }
    };

    // Fetch heatmap data
    const fetchHeatmap = async (year) => {
        try {
            const res = await API.get(`/api/analytics/data/?year=${year}`);
            setHeatmapData(res.data.data);
            setAvailableYears(res.data.years);
            setSelectedYear(res.data.selected_year);

            const map = {};
            res.data.data.forEach((d) => {
                map[d.date] = d;
            });
            setDataMap(map);

            // Default to today
            const todayStr = new Date().toLocaleDateString('en-CA');
            const dayData = map[todayStr];
            setSelectedDateStats({
                date: 'Today',
                hours: dayData ? dayData.hours : 0.0,
                completed: dayData ? dayData.tasks_completed : 0,
                total: dayData ? dayData.total_tasks : 0
            });
        } catch (err) {
            console.error('Failed to load heatmap data:', err);
        }
    };

    useEffect(() => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        setCurrentDate(today);
        fetchStatusAndTodos();
        fetchHeatmap(new Date().getFullYear());
        fetchGroupStatus();

        // Periodically refresh group status every 10s
        const groupInterval = setInterval(fetchGroupStatus, 10000);
        return () => clearInterval(groupInterval);
    }, []);

    // Local interval timers for clock and session counters
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            
            // 1. Update Analog Clock hands (based on local user time)
            const sec = now.getSeconds();
            const min = now.getMinutes();
            const hr = now.getHours();
            setClockAngles({
                hour: ((hr % 12) * 30) + (min * 0.5) - 90,
                minute: (min * 6) - 90,
                second: (sec * 6) - 90
            });

            // 2. Update Work Timers
            if (isActive && startTime && !autoEndAttempted.current) {
                const totalElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                setTotalSeconds(totalElapsed);

                let currentNetSeconds = 0;
                if (isBreak && currentBreakStart) {
                    const activeBreak = Math.floor((now.getTime() - currentBreakStart.getTime()) / 1000);
                    const accumBreak = totalBreakSeconds + activeBreak;
                    setBreakSeconds(accumBreak);
                    currentNetSeconds = totalElapsed - accumBreak;
                    setNetSeconds(currentNetSeconds);
                } else {
                    setBreakSeconds(totalBreakSeconds);
                    currentNetSeconds = totalElapsed - totalBreakSeconds;
                    setNetSeconds(currentNetSeconds);
                }

                // Check for auto-end
                if (!user?.profile?.use_fixed_schedule) {
                    const targetSeconds = parseFloat(user?.profile?.daily_hours_target || 9.0) * 3600;
                    if (currentNetSeconds >= targetSeconds) {
                        autoEndAttempted.current = true;
                        // Stop visually immediately
                        setNetSeconds(targetSeconds);
                        setTotalSeconds(targetSeconds + totalBreakSeconds);
                        
                        API.post('/api/attendance/end/', {})
                            .then((res) => {
                                applyAttendanceStatus(res.data);
                                fetchHeatmap(selectedYear);
                            })
                            .catch((err) => console.error('Failed to auto end work', err));
                    }
                } else {
                    const endTimeStr = user?.profile?.work_end_time;
                    if (endTimeStr) {
                        const [eh, em] = endTimeStr.split(':').map(Number);
                        const endLimit = startTime ? new Date(startTime) : new Date();
                        endLimit.setHours(eh, em || 0, 0, 0);
                        if (startTime && endLimit <= startTime) {
                            endLimit.setDate(endLimit.getDate() + 1);
                        } else if (!startTime) {
                            const [sh, sm] = (user?.profile?.work_start_time || '09:00').split(':').map(Number);
                            if (eh < sh || (eh === sh && (em || 0) <= (sm || 0))) {
                                endLimit.setDate(endLimit.getDate() + 1);
                            }
                        }
                        if (now >= endLimit) {
                            autoEndAttempted.current = true;
                            API.post('/api/attendance/end/', {})
                                .then((res) => {
                                    applyAttendanceStatus(res.data);
                                    fetchHeatmap(selectedYear);
                                })
                                .catch((err) => console.error('Failed to auto end work', err));
                        }
                    }
                }
            } else if (startTime && endTime) {
                const totalElapsed = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
                setTotalSeconds(totalElapsed);
                setBreakSeconds(totalBreakSeconds);
                setNetSeconds(totalElapsed - totalBreakSeconds);
            } else {
                setTotalSeconds(0);
                setBreakSeconds(0);
                setNetSeconds(0);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, isBreak, startTime, endTime, totalBreakSeconds, currentBreakStart, user]);

    // Word validation for reasons
    const countWords = (text) => {
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    };

    // Actions
    const handleStartWorkClick = () => {
        // Enforce checking if user has added tasks
        if (todos.length === 0) {
            setShowConfirmStart(true);
        } else {
            proceedStartWork();
        }
    };

    const proceedStartWork = async () => {
        setShowConfirmStart(false);
        setReasonError('');

        // Fixed Mode: Check if clocking in late
        if (user?.profile?.use_fixed_schedule) {
            const now = new Date();
            const startTimeStr = user.profile.work_start_time; // "HH:MM:SS"
            const [sh, sm] = startTimeStr.split(':').map(Number);
            const startLimit = new Date();
            startLimit.setHours(sh, sm, 0, 0);
            
            // Add 5 minutes grace period
            startLimit.setMinutes(startLimit.getMinutes() + 5);

            if (now > startLimit) {
                setReasonType('late');
                setReasonText('');
                setShowReasonModal(true);
                return;
            }
        }

        // Optimistic UI update: Start instantly on screen
        const optimisticStart = new Date();
        setIsActive(true);
        setStartTime(optimisticStart);
        setEndTime(null);

        try {
            const res = await API.post('/api/attendance/start/', {});
            applyAttendanceStatus(res.data);
        } catch (err) {
            // Roll back on failure
            fetchStatusAndTodos();
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to start work.');
        }
    };

    const handleStartWorkWithReason = async () => {
        if (countWords(reasonText) < 15) {
            setReasonError('Please write a reason of at least 15 words.');
            return;
        }

        setShowReasonModal(false);
        // Optimistic UI update
        const optimisticStart = new Date();
        setIsActive(true);
        setStartTime(optimisticStart);
        setEndTime(null);

        try {
            const res = await API.post('/api/attendance/start/', { late_reason: reasonText });
            applyAttendanceStatus(res.data);
        } catch (err) {
            fetchStatusAndTodos();
            setShowReasonModal(true);
            setReasonError(err.response?.data?.message || err.response?.data?.error || 'Failed to start work.');
        }
    };

    const handleEndWorkClick = () => {
        const now = new Date();
        let early = false;

        if (user?.profile?.use_fixed_schedule) {
            // Fixed Mode: check if before end_time
            const endTimeStr = user.profile.work_end_time;
            const [eh, em] = endTimeStr.split(':').map(Number);
            const endLimit = startTime ? new Date(startTime) : new Date();
            endLimit.setHours(eh, em || 0, 0, 0);
            if (startTime && endLimit <= startTime) {
                endLimit.setDate(endLimit.getDate() + 1);
            } else if (!startTime) {
                const [sh, sm] = (user?.profile?.work_start_time || '09:00').split(':').map(Number);
                if (eh < sh || (eh === sh && (em || 0) <= (sm || 0))) {
                    endLimit.setDate(endLimit.getDate() + 1);
                }
            }
            if (now < endLimit) {
                early = true;
            }
        } else {
            // Flexible Mode: check if net worked hours < daily target
            const workedHours = netSeconds / 3600.0;
            const target = parseFloat(user?.profile?.daily_hours_target || 9.0);
            if (workedHours < target) {
                early = true;
            }
        }

        if (early) {
            setReasonType('early');
            setReasonText('');
            setShowReasonModal(true);
        } else {
            proceedEndWork();
        }
    };

    const proceedEndWork = async () => {
        // Optimistic UI update: stop session immediately
        const optimisticEnd = new Date();
        setIsActive(false);
        setIsBreak(false);
        setEndTime(optimisticEnd);

        try {
            const res = await API.post('/api/attendance/end/', {});
            applyAttendanceStatus(res.data);
            fetchHeatmap(selectedYear);
        } catch (err) {
            fetchStatusAndTodos();
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to end work.');
        }
    };

    const handleEndWorkWithReason = async () => {
        if (countWords(reasonText) < 15) {
            setReasonError('Please write a reason of at least 15 words.');
            return;
        }

        setShowReasonModal(false);
        const optimisticEnd = new Date();
        setIsActive(false);
        setIsBreak(false);
        setEndTime(optimisticEnd);

        try {
            const res = await API.post('/api/attendance/end/', { early_leave_reason: reasonText });
            applyAttendanceStatus(res.data);
            fetchHeatmap(selectedYear);
        } catch (err) {
            fetchStatusAndTodos();
            setShowReasonModal(true);
            setReasonError(err.response?.data?.message || err.response?.data?.error || 'Failed to end work.');
        }
    };

    const handleToggleBreak = async () => {
        const enteringBreak = !isBreak;
        const now = new Date();

        // Optimistic break switch
        if (enteringBreak) {
            setIsBreak(true);
            setCurrentBreakStart(now);
        } else {
            setIsBreak(false);
            if (currentBreakStart) {
                const addedBreak = Math.floor((now.getTime() - currentBreakStart.getTime()) / 1000);
                setTotalBreakSeconds(prev => prev + addedBreak);
            }
            setCurrentBreakStart(null);
        }

        try {
            let res;
            if (!enteringBreak) {
                res = await API.post('/api/attendance/end-break/');
            } else {
                res = await API.post('/api/attendance/start-break/');
            }
            applyAttendanceStatus(res.data);
        } catch (err) {
            fetchStatusAndTodos();
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to toggle break.');
        }
    };

    // Todo Actions
    const handleAddTodo = async (e) => {
        e.preventDefault();
        const trimmedTitle = newTodo.trim();
        if (!trimmedTitle) return;

        const tempId = `temp-${Date.now()}`;
        const optimisticTodo = {
            id: tempId,
            title: trimmedTitle,
            is_completed: false,
            date: new Date().toLocaleDateString('en-CA'),
            created_at: new Date().toISOString()
        };

        // Instantly update UI and reset input for zero-latency user experience
        setTodos((prev) => [...prev, optimisticTodo]);
        setNewTodo('');

        try {
            const res = await API.post('/api/todos/add/', { title: trimmedTitle });
            if (res.data?.todo) {
                const realTodo = res.data.todo;
                // If user deleted this task while creation was in-flight:
                if (pendingDeletesRef.current.has(tempId)) {
                    pendingDeletesRef.current.delete(tempId);
                    // Silently delete from server now that we have the real ID
                    API.post(`/api/todos/delete/${realTodo.id}/`).catch(() => {});
                } else {
                    // Check if user toggled this task while creation was in-flight:
                    if (pendingTogglesRef.current.has(tempId)) {
                        const desiredCompleted = pendingTogglesRef.current.get(tempId);
                        pendingTogglesRef.current.delete(tempId);
                        realTodo.is_completed = desiredCompleted;
                        API.post(`/api/todos/toggle/${realTodo.id}/`).catch(() => {});
                    }
                    // Replace optimistic task with authoritative record from backend
                    setTodos((prev) => prev.map((t) => (t.id === tempId ? realTodo : t)));
                }
            }
        } catch (err) {
            pendingDeletesRef.current.delete(tempId);
            pendingTogglesRef.current.delete(tempId);
            // Revert state on failure
            setTodos((prev) => prev.filter((t) => t.id !== tempId));
            alert(err.response?.data?.error || 'Failed to add task.');
        }
    };

    const handleToggleTodo = async (id) => {
        // Optimistically flip checkbox state immediately
        let newStatus = false;
        setTodos((prev) =>
            prev.map((t) => {
                if (t.id === id) {
                    newStatus = !t.is_completed;
                    return { ...t, is_completed: newStatus };
                }
                return t;
            })
        );

        // If task was just created and is still waiting for backend ID:
        if (typeof id === 'string' && id.startsWith('temp-')) {
            pendingTogglesRef.current.set(id, newStatus);
            return;
        }

        try {
            const res = await API.post(`/api/todos/toggle/${id}/`);
            if (res.data?.status === 'success' && typeof res.data.is_completed === 'boolean') {
                setTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, is_completed: res.data.is_completed } : t))
                );
            }
        } catch (err) {
            // Roll back to previous state on failure
            setTodos((prev) =>
                prev.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t))
            );
            alert(err.response?.data?.error || 'Failed to toggle task.');
        }
    };

    const handleDeleteTodo = async (id) => {
        const todoToDelete = todos.find((t) => t.id === id);
        if (!todoToDelete) return;

        // Optimistically remove from list immediately
        setTodos((prev) => prev.filter((t) => t.id !== id));

        // If the task was just added and is still waiting for server ID:
        if (typeof id === 'string' && id.startsWith('temp-')) {
            pendingDeletesRef.current.add(id);
            return;
        }

        try {
            await API.post(`/api/todos/delete/${id}/`);
        } catch (err) {
            // Revert on error
            setTodos((prev) => [...prev, todoToDelete]);
            alert(err.response?.data?.error || 'Failed to delete task.');
        }
    };

    // Format seconds to HH:MM:SS
    const formatTime = (totalSecs) => {
        // Ensure we don't have negative time
        const safeSecs = Math.max(0, totalSecs);
        const hrs = String(Math.floor(safeSecs / 3600)).padStart(2, '0');
        const mins = String(Math.floor((safeSecs % 3600) / 60)).padStart(2, '0');
        const secs = String(Math.floor(safeSecs % 60)).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    // Heatmap calendar grid calculations
    const renderHeatmapGrid = () => {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        return monthNames.map((monthName, monthIdx) => {
            const firstDayOfMonth = new Date(selectedYear, monthIdx, 1);
            const lastDayOfMonth = new Date(selectedYear, monthIdx + 1, 0);

            const startDate = new Date(firstDayOfMonth);
            startDate.setDate(startDate.getDate() - startDate.getDay());

            const endDate = new Date(lastDayOfMonth);
            endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

            let currentDay = new Date(startDate);
            const weeks = [];
            let colIndex = 0;

            while (currentDay <= endDate) {
                const columnCells = [];
                for (let row = 0; row < 7; row++) {
                    const dateStr = currentDay.toLocaleDateString('en-CA'); // YYYY-MM-DD format
                    const dayData = dataMap[dateStr];
                    
                    const cellDate = new Date(currentDay);
                    cellDate.setHours(0, 0, 0, 0);

                    const isFuture = cellDate > todayDate;
                    const isCurrentMonthAndYear = currentDay.getFullYear() === selectedYear && currentDay.getMonth() === monthIdx;

                    let cellClass = 'heatmap-cell';
                    if (isCurrentMonthAndYear && dayData && dayData.hours > 0) {
                        cellClass += ' level-4';
                    }

                    columnCells.push(
                        <div
                            key={row}
                            className={cellClass}
                            style={{
                                visibility: isCurrentMonthAndYear ? 'visible' : 'hidden',
                                cursor: (isCurrentMonthAndYear && !isFuture) ? 'pointer' : 'default',
                            }}
                            title={isCurrentMonthAndYear ? `${dateStr}` : ''}
                            onClick={() => {
                                if (isCurrentMonthAndYear && !isFuture) {
                                    setSelectedDateStats({
                                        date: dateStr,
                                        hours: dayData ? dayData.hours : 0.0,
                                        completed: dayData ? dayData.tasks_completed : 0,
                                        total: dayData ? dayData.total_tasks : 0
                                    });
                                }
                            }}
                        />
                    );
                    currentDay.setDate(currentDay.getDate() + 1);
                }
                weeks.push(
                    <div key={colIndex} className="heatmap-col">
                        {columnCells}
                    </div>
                );
                colIndex++;
            }

            return (
                <div key={monthIdx} className="d-flex flex-column align-items-center" style={{ gap: '8px' }}>
                    <div className="d-flex" style={{ gap: '4px' }}>
                        {weeks}
                    </div>
                    <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                        {monthName}
                    </div>
                </div>
            );
        });
    };

    const activeTodosCount = todos.filter(t => t.is_completed).length;

    const renderAttendanceCard = () => (
        <div className="card h-100 border-0 shadow-sm rounded-4">
            <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <h5 className="fw-bold mb-4">Work Attendance</h5>
                <div className="text-muted small fw-medium text-uppercase mb-1">
                    {isBreak ? 'Break Session Active' : 'Total Work Time'}
                </div>
                <div className="display-4 fw-bold text-primary mb-3 font-monospace">
                    {formatTime(totalSeconds)}
                </div>
                
                {/* Breaks / Net details (hidden if not active) */}
                {(isActive || endTime) && (
                    <div className="w-100 mb-3">
                        <div className="row g-2">
                            <div className="col-6">
                                <div className="p-2 bg-warning-subtle text-warning border border-warning-subtle rounded-3 text-center">
                                    <div className="small fw-semibold text-uppercase" style={{ fontSize: '0.75rem' }}>
                                        <i className="bi bi-cup-hot me-1"></i> Break
                                    </div>
                                    <div className="font-monospace fw-bold">{formatTime(breakSeconds)}</div>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="p-2 bg-success-subtle text-success border border-success-subtle rounded-3 text-center">
                                    <div className="small fw-semibold text-uppercase" style={{ fontSize: '0.75rem' }}>
                                        <i className="bi bi-briefcase me-1"></i> Net Work
                                    </div>
                                    <div className="font-monospace fw-bold">{formatTime(netSeconds)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="d-flex gap-2 w-100 mb-3">
                    {!isActive && !endTime ? (
                        <button className="btn btn-primary flex-grow-1 py-2 fw-medium rounded-pill" onClick={handleStartWorkClick}>
                            Start Work
                        </button>
                    ) : isActive ? (
                        <button className="btn btn-outline-danger flex-grow-1 py-2 fw-medium rounded-pill" onClick={handleEndWorkClick}>
                            End Work
                        </button>
                    ) : (
                        <button className="btn btn-secondary flex-grow-1 py-2 fw-medium rounded-pill" disabled>
                            Shift Ended
                        </button>
                    )}
                </div>

                {isActive && (
                    <div className="w-100">
                        <button className={`btn w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2 ${isBreak ? 'btn-success' : 'btn-warning'}`} onClick={handleToggleBreak}>
                            <i className={isBreak ? 'bi bi-play-fill' : 'bi bi-pause-fill'}></i>
                            {isBreak ? 'Resume Work' : 'Go on Break'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderTodoCard = () => (
        <div className="card h-100 border-0 shadow-sm rounded-4">
            <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold mb-0">Today's Todo List</h5>
                    <span className="badge bg-primary rounded-pill">
                        {activeTodosCount}/{todos.length}
                    </span>
                </div>
                
                <form onSubmit={handleAddTodo} className="input-group mb-4">
                    <input
                        type="text"
                        className="form-control rounded-start-pill bg-light border-0 px-4 py-2"
                        placeholder="Add a task..."
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        disabled={isActive || endTime}
                    />
                    <button type="submit" className="btn btn-primary rounded-end-pill px-4" disabled={isActive || endTime}>
                        Add
                    </button>
                </form>

                <div className="todo-list flex-grow-1 overflow-auto" style={{ maxHeight: isSplitView ? '240px' : '200px' }}>
                    {todos.length === 0 ? (
                        <div className="text-center text-muted py-3 small">No tasks for today. Add one above!</div>
                    ) : (
                        todos.map((todo) => (
                            <div key={todo.id} className="todo-item d-flex align-items-center justify-content-between p-2 mb-1 border-bottom border-secondary-subtle">
                                <div className="d-flex align-items-center gap-3">
                                    <input
                                        type="checkbox"
                                        className="form-check-input todo-checkbox"
                                        checked={todo.is_completed}
                                        onChange={() => handleToggleTodo(todo.id)}
                                        disabled={!isActive}
                                    />
                                    <span className={`todo-text ${todo.is_completed ? 'completed' : ''}`}>
                                        {todo.title}
                                    </span>
                                </div>
                                <button className="btn btn-link text-danger p-0" onClick={() => handleDeleteTodo(todo.id)} disabled={endTime}>
                                    <i className="bi bi-trash"></i>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    const renderClockCard = () => (
        <div className="card h-100 border-0 shadow-sm rounded-4">
            <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <h5 className="fw-bold mb-4">Current Time</h5>
                <div className="analog-clock mb-3">
                    <div className="clock-face">
                        {CLOCK_MARKERS.map((marker) => (
                            <div
                                key={marker.value}
                                className={`clock-marker ${marker.isMain ? 'main-marker' : 'dot-marker'}`}
                                style={marker.style}
                            >
                                {marker.isMain ? marker.value : ''}
                            </div>
                        ))}
                        <div className="hand hour-hand" style={{ transform: `rotate(${clockAngles.hour}deg)` }}></div>
                        <div className="hand min-hand" style={{ transform: `rotate(${clockAngles.minute}deg)` }}></div>
                        <div className="hand second-hand" style={{ transform: `rotate(${clockAngles.second}deg)` }}></div>
                        <div className="clock-center"></div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderHeatmapSection = () => (
        <div className="row g-4">
            <div className="col-12">
                <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body p-4">
                        <h5 className="fw-bold mb-4">Performance Heatmap</h5>
                        <div className="row">
                            <div className="col-12 col-lg-10">
                                <div className="d-flex mb-4 pb-2">
                                    <div className="heatmap-days text-muted small me-2 d-flex flex-column" style={{ marginTop: '0px', gap: '4px', fontSize: '0.75rem' }}>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Sun</div>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Mon</div>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Tue</div>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Wed</div>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Thu</div>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Fri</div>
                                        <div style={{ height: '14px', lineHeight: '14px' }}>Sat</div>
                                    </div>
                                    
                                    <div className="flex-grow-1 overflow-auto">
                                        <div className="heatmap-container d-flex align-items-start" style={{ gap: '16px' }}>
                                            {renderHeatmapGrid()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-lg-2 border-start-lg pt-3 pt-lg-0 mt-3 mt-lg-0">
                                <div className="d-flex flex-row flex-lg-column gap-2 justify-content-center justify-content-lg-start">
                                    {availableYears.map((y) => (
                                        <button
                                            key={y}
                                            className={`btn btn-sm py-2 px-3 rounded-pill text-center ${y === selectedYear ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                                            onClick={() => fetchHeatmap(y)}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* Selected Date Stats */}
                        <div className="d-flex align-items-center mt-4 mb-2">
                            <h6 className="fw-bold mb-0 text-muted">Stats for {selectedDateStats.date}</h6>
                        </div>
                        <div className="row text-center g-3 justify-content-center">
                            <div className="col-6 col-md-4">
                                <div className="p-3 bg-light rounded-4 h-100 d-flex flex-column justify-content-center">
                                    <div className="text-muted small fw-medium text-uppercase">Tasks Done</div>
                                    <div className="fs-4 fw-bold text-info">
                                        {selectedDateStats.completed} / {selectedDateStats.total}
                                    </div>
                                </div>
                            </div>
                            <div className="col-6 col-md-4">
                                <div className="p-3 bg-light rounded-4 h-100 d-flex flex-column justify-content-center">
                                    <div className="text-muted small fw-medium text-uppercase">Hours Worked</div>
                                    <div className="fs-4 fw-bold text-success">
                                        {parseFloat(selectedDateStats.hours).toFixed(1)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="text-start position-relative">
            {/* Greeting & Group Mode Switcher Header */}
            <div className="row mb-4 align-items-center">
                <div className="col-12 col-md-7">
                    <h2 className="fw-bold mb-1">Hello, {user?.first_name || user?.username} 👋</h2>
                    <p className="text-muted mb-0" id="currentDateDisplay">Today's Date: {currentDate}</p>
                </div>
                {(groupStatus?.count > 0 || groupStatus?.peers?.length > 0) && (
                    <div className="col-12 col-md-5 d-flex justify-content-md-end align-items-center gap-2 mt-3 mt-md-0">
                        <button 
                            className={`btn ${isSplitView ? 'btn-primary' : 'btn-outline-primary'} rounded-pill px-3 py-2 fw-medium d-flex align-items-center gap-2 shadow-sm`}
                            onClick={() => setIsSplitView(!isSplitView)}
                        >
                            <i className="bi bi-layout-split"></i>
                            <span>{isSplitView ? 'Solo View' : 'Side-by-Side View'}</span>
                            <span className="badge bg-white text-dark rounded-pill px-2 font-monospace">
                                {groupStatus?.count || groupStatus?.peers?.length || 0}/10
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* Split View vs Full View */}
            {isSplitView ? (
                <div className="row g-4 mb-4">
                    {/* Left Half: My Workspace (Interactive) */}
                    <div className="col-12 col-xl-6">
                        <div className="d-flex flex-column gap-4">
                            <div className="d-flex align-items-center justify-content-between p-3 bg-glass rounded-4 border border-secondary-subtle">
                                <span className="small fw-bold text-primary d-flex align-items-center gap-2">
                                    <i className="bi bi-person-workspace"></i> My Workspace (Interactive)
                                </span>
                                <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1">
                                    {isActive ? '🟢 Working' : isBreak ? '🟡 On Break' : '⚪ Shift Idle'}
                                </span>
                            </div>

                            <div>
                                {renderAttendanceCard()}
                            </div>

                            <div>
                                {renderTodoCard()}
                            </div>

                            <div>
                                {renderClockCard()}
                            </div>
                        </div>
                    </div>

                    {/* Right Half: Group Study Peer View (Read-Only) */}
                    <div className="col-12 col-xl-6">
                        <GroupStudyPeerPanel 
                            user={user}
                            groupStatus={groupStatus}
                            onCloseSplitView={() => setIsSplitView(false)}
                            onOpenModal={() => setShowGroupModal(true)}
                            onRefreshGroup={fetchGroupStatus}
                        />
                    </div>
                </div>
            ) : (
                /* Full View (3 Columns) */
                <div className="row g-4 mb-4">
                    <div className="col-12 col-md-6 col-lg-4">
                        {renderAttendanceCard()}
                    </div>
                    <div className="col-12 col-md-6 col-lg-5">
                        {renderTodoCard()}
                    </div>
                    <div className="col-12 col-md-12 col-lg-3">
                        {renderClockCard()}
                    </div>
                </div>
            )}

            {/* Performance Heatmap Section */}
            {renderHeatmapSection()}

            {/* Floating Group Study Modal & FAB Button */}
            <GroupStudyModal 
                user={user}
                groupStatus={groupStatus}
                onRefreshGroup={fetchGroupStatus}
                isSplitView={isSplitView}
                onToggleSplitView={setIsSplitView}
                isOpen={showGroupModal}
                onOpen={() => setShowGroupModal(true)}
                onClose={() => setShowGroupModal(false)}
            />

            {/* Confirm Start Modal */}
            {showConfirmStart && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            {showConfirmStart && (
                <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow text-center">
                            <div className="modal-header border-0 pb-0 justify-content-end">
                                <button type="button" className="btn-close" onClick={() => setShowConfirmStart(false)}></button>
                            </div>
                            <div className="modal-body py-4">
                                <div className="mb-3 text-warning">
                                    <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '3rem' }}></i>
                                </div>
                                <p className="fs-6 fw-medium mb-1">Have you added all your tasks for today?</p>
                                <p className="text-muted small mb-0">You won't be able to add more after starting work.</p>
                            </div>
                            <div className="modal-footer border-0 pt-0 d-flex justify-content-center gap-2">
                                <button type="button" className="btn btn-light px-4 rounded-pill fw-medium" onClick={() => setShowConfirmStart(false)}>Cancel</button>
                                <button type="button" className="btn btn-primary px-4 rounded-pill fw-medium" onClick={proceedStartWork}>Yes, Start Work</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reason Modal */}
            {showReasonModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            {showReasonModal && (
                <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-0 pb-0">
                                <h1 className="modal-title fs-5 fw-bold">Reason Required</h1>
                                <button type="button" className="btn-close" onClick={() => setShowReasonModal(false)}></button>
                            </div>
                            <div className="modal-body text-start">
                                {reasonError && <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">{reasonError}</div>}
                                <p className="text-muted small mb-2">
                                    Please provide a reason. Minimum 15 words required.
                                </p>
                                <textarea
                                    className="form-control bg-body-tertiary border-0"
                                    rows="4"
                                    placeholder="Type your reason here..."
                                    value={reasonText}
                                    onChange={(e) => setReasonText(e.target.value)}
                                ></textarea>
                                <div className="text-end mt-2 small fw-bold text-muted">
                                    {countWords(reasonText)} / 15 words
                                </div>
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button type="button" className="btn btn-light" onClick={() => setShowReasonModal(false)}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn btn-primary px-4 fw-medium"
                                    onClick={reasonType === 'late' ? handleStartWorkWithReason : handleEndWorkWithReason}
                                    disabled={countWords(reasonText) < 15}
                                >
                                    Submit & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
