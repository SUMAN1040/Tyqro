import React, { useState, useEffect, useRef } from 'react';
import { API } from '../api';

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
    const [todoLoading, setTodoLoading] = useState(false);

    // Heatmap / Stats states
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [heatmapData, setHeatmapData] = useState([]);
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [dataMap, setDataMap] = useState({});
    const [selectedDateStats, setSelectedDateStats] = useState({ date: 'Today', hours: 0, completed: 0, total: 0 });

    // Modals & Reason Prompt states
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [reasonType, setReasonType] = useState(''); // 'late' or 'early'
    const [reasonText, setReasonText] = useState('');
    const [reasonError, setReasonError] = useState('');
    const [showConfirmStart, setShowConfirmStart] = useState(false);

    // Fetch initial status and todos
    const fetchStatusAndTodos = async () => {
        try {
            // Fetch timer status
            const statusRes = await API.get('/api/attendance/status/');
            const status = statusRes.data;
            setIsActive(status.is_active);
            setStartTime(status.start_time ? new Date(status.start_time) : null);
            setEndTime(status.end_time ? new Date(status.end_time) : null);
            setTotalBreakSeconds(status.total_break_duration);
            setCurrentBreakStart(status.current_break_start ? new Date(status.current_break_start) : null);
            setIsBreak(status.current_break_start !== null);

            // Fetch daily todos
            const todosRes = await API.get('/api/todos/list/');
            setTodos(todosRes.data.todos);
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
    }, []);

    // Local interval timers for clock and session counters
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            
            // 1. Update Analog Clock hands (based on IST)
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const ist = new Date(utc + (3600000 * 5.5));
            const sec = ist.getSeconds();
            const min = ist.getMinutes();
            const hr = ist.getHours();
            setClockAngles({
                hour: ((hr % 12) * 30) + (min * 0.5) - 90,
                minute: (min * 6) - 90,
                second: (sec * 6) - 90
            });

            // 2. Update Work Timers
            if (isActive && startTime) {
                const totalElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                setTotalSeconds(totalElapsed);

                if (isBreak && currentBreakStart) {
                    const activeBreak = Math.floor((now.getTime() - currentBreakStart.getTime()) / 1000);
                    const accumBreak = totalBreakSeconds + activeBreak;
                    setBreakSeconds(accumBreak);
                    setNetSeconds(totalElapsed - accumBreak);
                } else {
                    setBreakSeconds(totalBreakSeconds);
                    setNetSeconds(totalElapsed - totalBreakSeconds);
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
    }, [isActive, isBreak, startTime, endTime, totalBreakSeconds, currentBreakStart]);

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

        // Call start endpoint directly
        try {
            await API.post('/api/attendance/start/', {});
            fetchStatusAndTodos();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to start work.');
        }
    };

    const handleStartWorkWithReason = async () => {
        if (countWords(reasonText) < 15) {
            setReasonError('Please write a reason of at least 15 words.');
            return;
        }

        try {
            await API.post('/api/attendance/start/', { late_reason: reasonText });
            setShowReasonModal(false);
            fetchStatusAndTodos();
        } catch (err) {
            setReasonError(err.response?.data?.error || 'Failed to start work.');
        }
    };

    const handleEndWorkClick = () => {
        const now = new Date();
        let early = false;

        if (user?.profile?.use_fixed_schedule) {
            // Fixed Mode: check if before end_time
            const endTimeStr = user.profile.work_end_time;
            const [eh, em] = endTimeStr.split(':').map(Number);
            const endLimit = new Date();
            endLimit.setHours(eh, em, 0, 0);
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
        try {
            await API.post('/api/attendance/end/', {});
            fetchStatusAndTodos();
            fetchHeatmap(selectedYear);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to end work.');
        }
    };

    const handleEndWorkWithReason = async () => {
        if (countWords(reasonText) < 15) {
            setReasonError('Please write a reason of at least 15 words.');
            return;
        }

        try {
            await API.post('/api/attendance/end/', { early_leave_reason: reasonText });
            setShowReasonModal(false);
            fetchStatusAndTodos();
            fetchHeatmap(selectedYear);
        } catch (err) {
            setReasonError(err.response?.data?.error || 'Failed to end work.');
        }
    };

    const handleToggleBreak = async () => {
        try {
            if (isBreak) {
                await API.post('/api/attendance/end-break/');
            } else {
                await API.post('/api/attendance/start-break/');
            }
            fetchStatusAndTodos();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to toggle break.');
        }
    };

    // Todo Actions
    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTodo.trim()) return;
        setTodoLoading(true);

        try {
            await API.post('/api/todos/add/', { title: newTodo.trim() });
            setNewTodo('');
            fetchStatusAndTodos();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add task.');
        } finally {
            setTodoLoading(false);
        }
    };

    const handleToggleTodo = async (id) => {
        try {
            await API.post(`/api/todos/toggle/${id}/`);
            fetchStatusAndTodos();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to toggle task.');
        }
    };

    const handleDeleteTodo = async (id) => {
        try {
            await API.post(`/api/todos/delete/${id}/`);
            fetchStatusAndTodos();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete task.');
        }
    };

    // Format seconds to HH:MM:SS
    const formatTime = (totalSecs) => {
        const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    // Heatmap calendar grid calculations
    const renderHeatmapGrid = () => {
        const cells = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabels = [];
        let lastMonthSeen = -1;

        const startDate = new Date(selectedYear, 0, 1);
        // Shift start date to the beginning of the week (Sunday)
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const endDate = new Date(selectedYear, 11, 31);
        let currentDay = new Date(startDate);
        let colIndex = 0;

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        while (currentDay <= endDate || currentDay.getDay() !== 0) {
            if (currentDay.getDay() === 0) {
                let recordedMonthForThisCol = false;
                for (let row = 0; row < 7; row++) {
                    const cellDate = new Date(currentDay);
                    cellDate.setDate(cellDate.getDate() + row);
                    
                    if (cellDate.getFullYear() === selectedYear && cellDate.getMonth() !== lastMonthSeen) {
                        if (!recordedMonthForThisCol) {
                            monthLabels.push({
                                label: monthNames[cellDate.getMonth()],
                                colIndex: colIndex
                            });
                            lastMonthSeen = cellDate.getMonth();
                            recordedMonthForThisCol = true;
                        }
                    }
                }

                const columnCells = [];
                
                for (let row = 0; row < 7; row++) {
                    const dateStr = currentDay.toLocaleDateString('en-CA'); // YYYY-MM-DD format
                    const dayData = dataMap[dateStr];
                    
                    const cellDate = new Date(currentDay);
                    cellDate.setHours(0, 0, 0, 0);

                    const isFuture = cellDate > todayDate;
                    const isSelectedYear = currentDay.getFullYear() === selectedYear;

                    let cellClass = 'heatmap-cell';
                    if (isSelectedYear && dayData && dayData.hours > 0) {
                        cellClass += ' level-4';
                    }

                    columnCells.push(
                        <div
                            key={row}
                            className={cellClass}
                            style={{
                                visibility: isSelectedYear ? 'visible' : 'hidden',
                                cursor: isFuture ? 'default' : 'pointer',
                            }}
                            title={isSelectedYear ? `${dateStr}` : ''}
                            onClick={() => {
                                if (isSelectedYear && !isFuture) {
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

                cells.push(
                    <div key={colIndex} className="heatmap-col">
                        {columnCells}
                    </div>
                );
                colIndex++;
            }
        }
        return { cells, monthLabels };
    };

    const activeTodosCount = todos.filter(t => t.is_completed).length;
    const { cells: heatmapCells, monthLabels } = renderHeatmapGrid();

    return (
        <div className="text-start">
            <div className="row mb-4">
                <div className="col-12">
                    <h2 className="fw-bold mb-1">Hello, {user?.first_name || user?.username} 👋</h2>
                    <p className="text-muted" id="currentDateDisplay">Today's Date: {currentDate}</p>
                </div>
            </div>

            <div className="row g-4 mb-4">
                {/* Attendance Timer Card */}
                <div className="col-md-4">
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
                </div>

                {/* Todo List Card */}
                <div className="col-md-5">
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
                                <button type="submit" className="btn btn-primary rounded-end-pill px-4" disabled={todoLoading || isActive || endTime}>
                                    Add
                                </button>
                            </form>

                            <div className="todo-list flex-grow-1 overflow-auto" style={{ maxHeight: '200px' }}>
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
                </div>

                {/* Clock Card */}
                <div className="col-md-3">
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
                </div>
            </div>

            {/* Performance Heatmap Section */}
            <div className="row g-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-body p-4">
                            <h5 className="fw-bold mb-4">Performance Heatmap</h5>
                            <div className="row">
                                <div className="col-md-10">
                                    <div className="d-flex mb-4 pb-2">
                                        <div className="heatmap-days text-muted small me-2 d-flex flex-column" style={{ marginTop: '20px', gap: '4px', fontSize: '0.75rem' }}>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Sun</div>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Mon</div>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Tue</div>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Wed</div>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Thu</div>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Fri</div>
                                            <div style={{ height: '14px', lineHeight: '14px' }}>Sat</div>
                                        </div>
                                        
                                        <div className="flex-grow-1 overflow-auto">
                                            {/* Months labeling (simulated header offsets) */}
                                            <div className="heatmap-months position-relative text-muted small mb-2" style={{ height: '20px', fontSize: '0.75rem' }}>
                                                {monthLabels.map((ml, idx) => (
                                                    <span key={idx} style={{ position: 'absolute', left: `${ml.colIndex * 18}px` }}>
                                                        {ml.label}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="heatmap-container d-flex" style={{ gap: '4px' }}>
                                                {heatmapCells}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-2 border-start">
                                    <div className="list-group list-group-flush">
                                        {availableYears.map((y) => (
                                            <button
                                                key={y}
                                                className={`list-group-item list-group-item-action border-0 rounded my-1 text-center py-2 ${y === selectedYear ? 'active bg-primary text-white' : 'bg-transparent text-body'}`}
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
                                    <div className="p-3 bg-light rounded-4">
                                        <div className="text-muted small fw-medium text-uppercase">Tasks Done</div>
                                        <div className="fs-4 fw-bold text-info">
                                            {selectedDateStats.completed} / {selectedDateStats.total}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-md-4">
                                    <div className="p-3 bg-light rounded-4">
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
