import React, { useState, useEffect, useRef, useMemo } from 'react';
import { API } from '../api';
import GroupStudyModal from '../components/GroupStudyModal';
import GroupStudyPeerPanel from '../components/GroupStudyPeerPanel';
import WorkSummaryModal from '../components/WorkSummaryModal';
import { generateWorkSummaryPDF } from '../utils/pdfGenerator';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

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
    const [isBreakLoading, setIsBreakLoading] = useState(false);
    const [breakError, setBreakError] = useState('');
    const isBreakTogglingRef = useRef(false);
    const [isStartingWork, setIsStartingWork] = useState(false);
    const [startWorkError, setStartWorkError] = useState('');
    
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
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [dataMap, setDataMap] = useState({});
    const [selectedDateStats, setSelectedDateStats] = useState({ date: 'Today', hours: 0, breakHours: 0, breakSeconds: 0, completed: 0, total: 0 });
    
    // Visualization Toggle & Graph states
    const [vizMode, setVizMode] = useState('heatmap'); // 'heatmap' | 'graph'
    const [graphRange, setGraphRange] = useState('month'); // '7d' | '14d' | 'month' | 'custom'
    const [customStartDate, setCustomStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 13);
        return d.toLocaleDateString('en-CA');
    });
    const [customEndDate, setCustomEndDate] = useState(() => new Date().toLocaleDateString('en-CA'));
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.getAttribute('data-bs-theme') === 'dark');

    const handleCustomDateChange = (type, val) => {
        if (!val) return;
        if (type === 'start') {
            setCustomStartDate(val);
        } else {
            setCustomEndDate(val);
        }
        const year = new Date(val).getFullYear();
        if (year && year !== selectedYear) {
            fetchHeatmap(year);
        }
    };

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

    // Uncheck Task Reason states
    const [showUncheckModal, setShowUncheckModal] = useState(false);
    const [uncheckTodoTarget, setUncheckTodoTarget] = useState(null);
    const [uncheckReason, setUncheckReason] = useState('');
    const [uncheckError, setUncheckError] = useState('');

    // Work Summary states
    const [summaryData, setSummaryData] = useState(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [summaryError, setSummaryError] = useState('');

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
        const active = Boolean(status.is_active && !status.end_time);
        setIsActive(active);
        if (!active) {
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
            setAvailableYears(res.data.years);
            setSelectedYear(res.data.selected_year);

            const newMap = {};
            res.data.data.forEach((d) => {
                newMap[d.date] = d;
            });
            setDataMap((prev) => ({ ...prev, ...newMap }));

            // Default to today
            const todayStr = new Date().toLocaleDateString('en-CA');
            const dayData = newMap[todayStr];
            setSelectedDateStats({
                date: 'Today',
                hours: dayData ? dayData.hours : 0.0,
                breakHours: dayData ? (dayData.break_hours || 0.0) : 0.0,
                breakSeconds: dayData ? (dayData.break_seconds || 0) : 0,
                completed: dayData ? dayData.tasks_completed : 0,
                total: dayData ? dayData.total_tasks : 0
            });
        } catch (err) {
            console.error('Failed to load heatmap data:', err);
        }
    };

    // Dark mode observer for chart theme synchronization
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.getAttribute('data-bs-theme') === 'dark');
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
        return () => observer.disconnect();
    }, []);

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
                const totalElapsed = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
                setTotalSeconds(totalElapsed);
                setBreakSeconds(totalBreakSeconds);
                setNetSeconds(Math.max(0, totalElapsed - totalBreakSeconds));
            } else {
                setTotalSeconds(0);
                setBreakSeconds(0);
                setNetSeconds(0);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, isBreak, startTime, endTime, totalBreakSeconds, currentBreakStart, user, selectedYear]);

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
        if (isStartingWork) return;
        setShowConfirmStart(false);
        setReasonError('');
        setStartWorkError('');

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

        setIsStartingWork(true);
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
            const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to start work.';
            setStartWorkError(msg);
            setTimeout(() => setStartWorkError(''), 4000);
        } finally {
            setIsStartingWork(false);
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

        setReasonType(early ? 'early' : 'end');
        setReasonText('');
        setShowReasonModal(true);
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
        setSummaryData(null);

        try {
            const res = await API.post('/api/attendance/end/', { 
                early_leave_reason: reasonText,
                end_reason: reasonText 
            });
            applyAttendanceStatus(res.data);
            fetchHeatmap(selectedYear);
        } catch (err) {
            fetchStatusAndTodos();
            setShowReasonModal(true);
            setReasonError(err.response?.data?.message || err.response?.data?.error || 'Failed to end work.');
        }
    };

    const handleGenerateSummary = async () => {
        setIsGeneratingSummary(true);
        setSummaryError('');
        try {
            const res = await API.get('/api/attendance/summary/');
            setSummaryData(res.data);
            setShowSummaryModal(true);
        } catch (err) {
            console.error('Failed to generate work summary:', err);
            setSummaryError(err.response?.data?.message || err.response?.data?.error || 'Failed to generate summary.');
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleDownloadSummaryPDF = async () => {
        setIsDownloadingPdf(true);
        try {
            const res = await API.get('/api/attendance/summary/');
            const freshData = res.data;
            setSummaryData(freshData);
            await generateWorkSummaryPDF(freshData);
        } catch (err) {
            console.error('Failed to export PDF summary:', err);
            if (summaryData) {
                await generateWorkSummaryPDF(summaryData);
            } else {
                alert('Could not download PDF summary. Please try again.');
            }
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleToggleBreak = async () => {
        // Prevent concurrent double-clicks or rapid bursts
        if (isBreakTogglingRef.current) return;
        isBreakTogglingRef.current = true;
        setIsBreakLoading(true);
        setBreakError('');

        const enteringBreak = !isBreak;
        const now = new Date();

        // Optimistic break switch
        if (enteringBreak) {
            setIsBreak(true);
            setCurrentBreakStart(now);
            // Optimistically pause any active task timer
            setTodos((prev) =>
                prev.map((t) => {
                    if (t.timer_started_at) {
                        const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(t.timer_started_at).getTime()) / 1000));
                        return {
                            ...t,
                            total_seconds: (t.total_seconds || 0) + elapsed,
                            timer_started_at: null,
                            is_timer_running: false,
                        };
                    }
                    return t;
                })
            );
        } else {
            setIsBreak(false);
            if (currentBreakStart) {
                const addedBreak = Math.max(0, Math.floor((now.getTime() - currentBreakStart.getTime()) / 1000));
                setTotalBreakSeconds(prev => prev + addedBreak);
            }
            setCurrentBreakStart(null);
        }

        try {
            const endpoint = enteringBreak ? '/api/attendance/start-break/' : '/api/attendance/end-break/';
            const res = await API.post(endpoint);
            applyAttendanceStatus(res.data);
        } catch (err) {
            console.error('Failed to toggle break:', err);
            fetchStatusAndTodos();
            const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to toggle break.';
            setBreakError(msg);
            setTimeout(() => setBreakError(''), 4000);
        } finally {
            setIsBreakLoading(false);
            // Cooldown debounce so rapid clicks are swallowed safely without freezing
            setTimeout(() => {
                isBreakTogglingRef.current = false;
            }, 300);
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

    const handleToggleTodo = (id) => {
        const targetTodo = todos.find((t) => t.id === id);
        if (!targetTodo) return;

        // If task is already completed, user cannot directly uncheck it without a 10-word reason
        if (targetTodo.is_completed) {
            setUncheckTodoTarget(targetTodo);
            setUncheckReason('');
            setUncheckError('');
            setShowUncheckModal(true);
            return;
        }

        // Checking an incomplete task proceeds immediately
        proceedToggleTodo(id, true);
    };

    const formatTaskDuration = (totalSecs) => {
        if (!totalSecs || totalSecs <= 0) return '00:00';
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        if (hrs > 0) {
            return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const handleToggleTaskTimer = async (todoId, isCurrentlyRunning) => {
        if (!isActive) {
            alert('Please start your work session before timing tasks.');
            return;
        }
        if (isBreak) {
            alert('Cannot run task timer while on break.');
            return;
        }

        const now = new Date();
        if (isCurrentlyRunning) {
            // Optimistically pause this task
            setTodos((prev) =>
                prev.map((t) => {
                    if (t.id === todoId) {
                        const elapsed = t.timer_started_at
                            ? Math.max(0, Math.floor((now.getTime() - new Date(t.timer_started_at).getTime()) / 1000))
                            : 0;
                        return {
                            ...t,
                            total_seconds: (t.total_seconds || 0) + elapsed,
                            timer_started_at: null,
                            is_timer_running: false,
                        };
                    }
                    return t;
                })
            );

            try {
                const res = await API.post(`/api/todos/pause-timer/${todoId}/`);
                if (res.data?.todos) {
                    setTodos(res.data.todos);
                }
            } catch (err) {
                console.error('Failed to pause task timer', err);
                fetchStatusAndTodos();
            }
        } else {
            // Optimistically start this task timer and pause all other active task timers
            setTodos((prev) =>
                prev.map((t) => {
                    if (t.id === todoId) {
                        return {
                            ...t,
                            timer_started_at: now.toISOString(),
                            is_timer_running: true,
                        };
                    } else if (t.timer_started_at) {
                        const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(t.timer_started_at).getTime()) / 1000));
                        return {
                            ...t,
                            total_seconds: (t.total_seconds || 0) + elapsed,
                            timer_started_at: null,
                            is_timer_running: false,
                        };
                    }
                    return t;
                })
            );

            try {
                const res = await API.post(`/api/todos/start-timer/${todoId}/`);
                if (res.data?.todos) {
                    setTodos(res.data.todos);
                }
            } catch (err) {
                console.error('Failed to start task timer', err);
                alert(err.response?.data?.error || 'Failed to start task timer');
                fetchStatusAndTodos();
            }
        }
    };

    const proceedToggleTodo = async (id, newStatus, reason = '') => {
        const now = new Date();
        // Optimistically update checkbox state immediately and pause running timer on completion
        setTodos((prev) =>
            prev.map((t) => {
                if (t.id === id) {
                    let addedSecs = 0;
                    if (newStatus && t.timer_started_at) {
                        addedSecs = Math.max(0, Math.floor((now.getTime() - new Date(t.timer_started_at).getTime()) / 1000));
                    }
                    return {
                        ...t,
                        is_completed: newStatus,
                        total_seconds: (t.total_seconds || 0) + addedSecs,
                        timer_started_at: newStatus ? null : t.timer_started_at,
                        is_timer_running: newStatus ? false : t.is_timer_running,
                    };
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
            const payload = reason ? { reason } : {};
            const res = await API.post(`/api/todos/toggle/${id}/`, payload);
            if (res.data?.status === 'success' && typeof res.data.is_completed === 'boolean') {
                setTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, ...(res.data.todo || {}), is_completed: res.data.is_completed } : t))
                );
                // Synchronize heatmap and daily stats
                fetchHeatmap(selectedYear);
            }
        } catch (err) {
            // Roll back to previous state on failure
            setTodos((prev) =>
                prev.map((t) => (t.id === id ? { ...t, is_completed: !newStatus } : t))
            );
            alert(err.response?.data?.error || 'Failed to toggle task.');
        }
    };

    const handleConfirmUncheck = async () => {
        if (!uncheckTodoTarget) return;
        const words = countWords(uncheckReason);
        if (words < 10) {
            setUncheckError(`A minimum 10-word reason is required. You provided ${words} word${words === 1 ? '' : 's'}.`);
            return;
        }

        const targetId = uncheckTodoTarget.id;
        const reason = uncheckReason.trim();

        setShowUncheckModal(false);
        setUncheckTodoTarget(null);
        setUncheckReason('');
        setUncheckError('');

        await proceedToggleTodo(targetId, false, reason);
    };

    const handleDeleteTodo = async (id) => {
        if (isActive || startTime || endTime) {
            alert('Cannot delete tasks once work has started.');
            return;
        }

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
            fetchHeatmap(selectedYear);
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
                                        breakHours: dayData ? (dayData.break_hours || 0.0) : 0.0,
                                        breakSeconds: dayData ? (dayData.break_seconds || 0) : 0,
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

                <div className="d-flex flex-column gap-2 w-100 mb-3">
                    {!isActive && !endTime ? (
                        <>
                            <button
                                className={`btn btn-primary w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2 ${isStartingWork ? 'opacity-75' : ''}`}
                                onClick={handleStartWorkClick}
                                disabled={isStartingWork}
                            >
                                {isStartingWork ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span>Starting Work...</span>
                                    </>
                                ) : (
                                    'Start Work'
                                )}
                            </button>
                            {startWorkError && (
                                <div className="alert alert-danger py-1 px-3 mt-1 mb-0 small text-center rounded-pill" role="alert">
                                    {startWorkError}
                                </div>
                            )}
                        </>
                    ) : isActive ? (
                        <button className="btn btn-outline-danger w-100 py-2 fw-medium rounded-pill" onClick={handleEndWorkClick}>
                            End Work
                        </button>
                    ) : (
                        <>
                            <button className="btn btn-secondary w-100 py-2 fw-medium rounded-pill opacity-75" disabled>
                                <i className="bi bi-check-circle-fill me-1"></i> Shift Ended
                            </button>

                            {!summaryData ? (
                                <button 
                                    className="btn btn-primary w-100 py-2.5 fw-semibold rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm"
                                    onClick={handleGenerateSummary}
                                    disabled={isGeneratingSummary}
                                >
                                    {isGeneratingSummary ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            Generating Summary...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-file-earmark-text-fill"></i>
                                            Generate Summary
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="d-flex gap-2 w-100">
                                    <button 
                                        className="btn btn-outline-primary flex-grow-1 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                                        onClick={() => setShowSummaryModal(true)}
                                    >
                                        <i className="bi bi-eye-fill"></i>
                                        View
                                    </button>
                                    <button 
                                        className="btn btn-success flex-grow-1 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                                        onClick={handleDownloadSummaryPDF}
                                        disabled={isDownloadingPdf}
                                    >
                                        {isDownloadingPdf ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : (
                                            <i className="bi bi-file-earmark-pdf-fill"></i>
                                        )}
                                        Download (PDF)
                                    </button>
                                </div>
                            )}

                            {summaryError && (
                                <div className="text-danger small mt-1">
                                    {summaryError}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {isActive && (
                    <div className="w-100">
                        <button
                            className={`btn w-100 py-2 fw-medium rounded-pill d-flex align-items-center justify-content-center gap-2 ${isBreak ? 'btn-success' : 'btn-warning'} ${isBreakLoading ? 'opacity-75' : ''}`}
                            onClick={handleToggleBreak}
                            disabled={isBreakLoading}
                        >
                            {isBreakLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    <span>{isBreak ? 'Resuming...' : 'Switching to Break...'}</span>
                                </>
                            ) : (
                                <>
                                    <i className={isBreak ? 'bi bi-play-fill' : 'bi bi-pause-fill'}></i>
                                    <span>{isBreak ? 'Resume Work' : 'Go on Break'}</span>
                                </>
                            )}
                        </button>
                        {breakError && (
                            <div className="alert alert-danger py-1 px-3 mt-2 mb-0 small text-center rounded-pill" role="alert">
                                {breakError}
                            </div>
                        )}
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
                        todos.map((todo) => {
                            const isWorkStarted = Boolean(isActive || startTime || endTime);
                            const isRunning = Boolean(todo.timer_started_at && !isBreak);

                            let liveSeconds = todo.total_seconds || 0;
                            if (isRunning && todo.timer_started_at) {
                                const diff = Math.max(0, Math.floor((Date.now() - new Date(todo.timer_started_at).getTime()) / 1000));
                                liveSeconds += diff;
                            }

                            const hasTime = liveSeconds > 0;

                            return (
                                <div key={todo.id} className="todo-item d-flex align-items-center justify-content-between p-2 mb-1 border-bottom border-secondary-subtle">
                                    <div className="d-flex align-items-center gap-3 min-w-0 me-2">
                                        <input
                                            type="checkbox"
                                            className="form-check-input todo-checkbox flex-shrink-0"
                                            checked={todo.is_completed}
                                            onChange={() => handleToggleTodo(todo.id)}
                                            disabled={!isActive}
                                            title={!isActive ? "Start your work timer to mark tasks" : (todo.is_completed ? "Click to uncheck (requires 10-word reason)" : "Click to complete task")}
                                        />
                                        <span className={`todo-text text-truncate ${todo.is_completed ? 'completed' : ''}`} title={todo.title}>
                                            {todo.title}
                                        </span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                        {/* Task Timer Badge (Live / Paused / Completed) */}
                                        {hasTime && (
                                            <span 
                                                className={`badge rounded-pill font-monospace px-2 py-1 ${
                                                    isRunning
                                                        ? 'bg-success-subtle text-success border border-success-subtle' 
                                                        : todo.is_completed 
                                                            ? 'bg-primary-subtle text-primary border border-primary-subtle' 
                                                            : 'bg-secondary-subtle text-body border border-secondary-subtle'
                                                }`}
                                                style={{ fontSize: '0.72rem' }}
                                                title={`Time logged: ${formatTaskDuration(liveSeconds)}`}
                                            >
                                                <i className={`bi ${isRunning ? 'bi-stopwatch-fill me-1' : 'bi-stopwatch me-1'}`}></i>
                                                {formatTaskDuration(liveSeconds)}
                                            </span>
                                        )}

                                        {/* Dynamic Control Button */}
                                        {!isWorkStarted ? (
                                            <button 
                                                type="button"
                                                className="btn btn-link p-0 text-danger" 
                                                onClick={() => handleDeleteTodo(todo.id)} 
                                                title="Delete task"
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        ) : todo.is_completed ? (
                                            <span className="text-success p-1" title="Task Completed">
                                                <i className="bi bi-check-circle-fill fs-6"></i>
                                            </span>
                                        ) : (
                                            <button 
                                                type="button"
                                                className={`btn btn-link p-0 text-decoration-none ${
                                                    isBreak 
                                                        ? 'text-muted opacity-50' 
                                                        : isRunning 
                                                            ? 'text-warning' 
                                                            : 'text-primary'
                                                }`}
                                                disabled={isBreak || !isActive}
                                                onClick={() => handleToggleTaskTimer(todo.id, isRunning)}
                                                title={
                                                    isBreak 
                                                        ? "Task timer paused while on break" 
                                                        : !isActive 
                                                            ? "Work session ended" 
                                                            : isRunning 
                                                                ? "Pause task timer" 
                                                                : "Start task timer"
                                                }
                                            >
                                                <i className={`bi fs-5 ${isRunning ? 'bi-pause-circle-fill' : 'bi-play-circle-fill'}`}></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
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

    const formatDuration = (hoursFloat) => {
        if (!hoursFloat || hoursFloat <= 0) return '0m';
        const totalMinutes = Math.round(Number(hoursFloat) * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    // Calculate data points for graph view based on selected range
    const graphDataList = useMemo(() => {
        const list = [];
        const today = new Date();
        
        if (graphRange === '7d' || graphRange === '14d') {
            const numDays = graphRange === '7d' ? 7 : 14;
            for (let i = numDays - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const dateStr = d.toLocaleDateString('en-CA');
                const dataItem = dataMap[dateStr] || {
                    date: dateStr,
                    hours: 0.0,
                    break_hours: 0.0,
                    break_seconds: 0,
                    tasks_completed: 0,
                    total_tasks: 0,
                };
                list.push(dataItem);
            }
        } else if (graphRange === 'month') {
            const year = selectedYear || today.getFullYear();
            const month = today.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const d = new Date(year, month, day);
                const dateStr = d.toLocaleDateString('en-CA');
                const dataItem = dataMap[dateStr] || {
                    date: dateStr,
                    hours: 0.0,
                    break_hours: 0.0,
                    break_seconds: 0,
                    tasks_completed: 0,
                    total_tasks: 0,
                };
                list.push(dataItem);
            }
        } else if (graphRange === 'custom') {
            const start = customStartDate ? new Date(customStartDate + 'T00:00:00') : new Date(today.getTime() - 13 * 86400000);
            const end = customEndDate ? new Date(customEndDate + 'T00:00:00') : today;

            const actualStart = start <= end ? start : end;
            const actualEnd = start <= end ? end : start;

            let curr = new Date(actualStart);
            let count = 0;
            while (curr <= actualEnd && count < 366) {
                const dateStr = curr.toLocaleDateString('en-CA');
                const dataItem = dataMap[dateStr] || {
                    date: dateStr,
                    hours: 0.0,
                    break_hours: 0.0,
                    break_seconds: 0,
                    tasks_completed: 0,
                    total_tasks: 0,
                };
                list.push(dataItem);
                curr.setDate(curr.getDate() + 1);
                count++;
            }
        }
        return list;
    }, [graphRange, dataMap, selectedYear, customStartDate, customEndDate]);

    const chartData = useMemo(() => {
        const labels = graphDataList.map((item) => {
            const d = new Date(item.date + 'T00:00:00');
            if (graphRange === '7d' || graphRange === '14d') {
                return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            }
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const workData = graphDataList.map((item) => Number(item.hours || 0));
        const breakData = graphDataList.map((item) => Number(item.break_hours || 0));

        // High-contrast, theme-adaptive palette (Heatmap Emerald Green + Luminous Amber Gold)
        const workColor = isDarkMode ? '#22c55e' : '#16a34a';
        const workHover = isDarkMode ? '#4ade80' : '#15803d';
        const breakColor = isDarkMode ? '#fbbf24' : '#d97706';
        const breakHover = isDarkMode ? '#fde047' : '#b45309';

        const barPct = graphDataList.length <= 7 
            ? 0.45 
            : graphDataList.length <= 14 
                ? 0.6 
                : graphDataList.length <= 31 
                    ? 0.72 
                    : 0.85;

        return {
            labels,
            datasets: [
                {
                    label: 'Work Time',
                    data: workData,
                    backgroundColor: workColor,
                    hoverBackgroundColor: workHover,
                    borderRadius: 4,
                    borderSkipped: false,
                    stack: 'timeStack',
                    barPercentage: barPct,
                },
                {
                    label: 'Break Time',
                    data: breakData,
                    backgroundColor: breakColor,
                    hoverBackgroundColor: breakHover,
                    borderRadius: 4,
                    borderSkipped: false,
                    stack: 'timeStack',
                    barPercentage: barPct,
                }
            ]
        };
    }, [graphDataList, graphRange, isDarkMode]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 400,
            easing: 'easeOutQuart',
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    display: false,
                },
                ticks: {
                    color: isDarkMode ? '#e2e8f0' : '#334155',
                    font: {
                        family: "'Inter', sans-serif",
                        size: 11,
                        weight: 600,
                    },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: graphDataList.length <= 7 ? 7 : graphDataList.length <= 14 ? 14 : Math.min(graphDataList.length, 16),
                    padding: 6,
                },
                border: {
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.2)',
                    width: 1.5,
                }
            },
            y: {
                stacked: true,
                min: 0,
                max: 24,
                ticks: {
                    stepSize: 4,
                    callback: (val) => `${val}h`,
                    color: isDarkMode ? '#e2e8f0' : '#334155',
                    font: {
                        family: "'Inter', sans-serif",
                        size: 11,
                        weight: 600,
                    },
                    padding: 8,
                },
                grid: {
                    color: (context) => {
                        if (context.tick && context.tick.value === 0) {
                            return isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)';
                        }
                        if (context.tick && context.tick.value === 24) {
                            return isDarkMode ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.2)';
                        }
                        return isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.14)';
                    },
                    borderDash: [5, 4],
                    lineWidth: (context) => (context.tick && context.tick.value === 0 ? 1.5 : 1.2),
                },
                border: {
                    dash: [5, 4],
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.18)',
                    width: 1.5,
                },
                title: {
                    display: true,
                    text: 'Hours (24h Max Range)',
                    color: isDarkMode ? '#e2e8f0' : '#475569',
                    font: {
                        family: "'Inter', sans-serif",
                        size: 11,
                        weight: 700,
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                enabled: true,
                backgroundColor: isDarkMode ? 'rgba(24, 27, 31, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                titleColor: isDarkMode ? '#ffffff' : '#111827',
                bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: 1,
                padding: 12,
                boxPadding: 5,
                usePointStyle: true,
                titleFont: {
                    family: "'Inter', sans-serif",
                    size: 13,
                    weight: 'bold',
                },
                bodyFont: {
                    family: "'Inter', sans-serif",
                    size: 12,
                },
                callbacks: {
                    title: (tooltipItems) => {
                        if (!tooltipItems.length) return '';
                        const idx = tooltipItems[0].dataIndex;
                        const item = graphDataList[idx];
                        if (!item) return tooltipItems[0].label;
                        const d = new Date(item.date + 'T00:00:00');
                        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
                    },
                    label: (context) => {
                        const idx = context.dataIndex;
                        const item = graphDataList[idx];
                        if (!item) return '';
                        const val = Number(context.raw || 0);
                        if (context.datasetIndex === 0) {
                            return `  ⏱️ Work Time: ${formatDuration(val)} (${val.toFixed(2)}h)`;
                        } else if (context.datasetIndex === 1) {
                            return `  ☕ Break Time: ${formatDuration(val)} (${val.toFixed(2)}h)`;
                        }
                        return '';
                    },
                    afterBody: (tooltipItems) => {
                        if (!tooltipItems.length) return [];
                        const idx = tooltipItems[0].dataIndex;
                        const item = graphDataList[idx];
                        if (!item) return [];
                        const completed = item.tasks_completed || 0;
                        const total = item.total_tasks || 0;
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                        const totalLogged = (Number(item.hours) || 0) + (Number(item.break_hours) || 0);
                        return [
                            `  📋 Tasks: ${completed} / ${total} completed (${pct}%)`,
                            `  ⏳ Total Day: ${formatDuration(totalLogged)} / 24h`
                        ];
                    }
                }
            }
        },
        onClick: (event, elements) => {
            if (elements && elements.length > 0) {
                const idx = elements[0].index;
                const item = graphDataList[idx];
                if (item) {
                    setSelectedDateStats({
                        date: item.date,
                        hours: item.hours || 0.0,
                        breakHours: item.break_hours || 0.0,
                        breakSeconds: item.break_seconds || 0,
                        completed: item.tasks_completed || 0,
                        total: item.total_tasks || 0
                    });
                }
            }
        }
    }), [graphDataList, isDarkMode]);

    const renderHeatmapSection = () => (
        <div className="row g-4">
            <div className="col-12">
                <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body p-4">
                        {/* Header with Title and Round Switch Button */}
                        <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
                            <div>
                                <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
                                    <i className={`bi ${vizMode === 'heatmap' ? 'bi-grid-3x3-gap-fill text-success' : 'bi-bar-chart-fill text-primary'}`}></i>
                                    {vizMode === 'heatmap' ? 'Performance Heatmap' : 'Timeline Activity Graph'}
                                </h5>
                                <p className="text-muted small mb-0">
                                    {vizMode === 'heatmap' 
                                        ? 'Yearly consistency grid tracking your daily productive activity' 
                                        : '24-hour daily timeline comparison of work, breaks, and task completions'}
                                </p>
                            </div>

                            {/* Round Switch Toggle Pill */}
                            <div className="viz-switcher-wrapper">
                                <button
                                    type="button"
                                    className={`btn btn-link p-0 text-decoration-none small fw-semibold d-flex align-items-center gap-1 ${vizMode === 'heatmap' ? 'text-primary' : 'text-muted'}`}
                                    onClick={() => setVizMode('heatmap')}
                                    title="View GitHub-style Performance Heatmap"
                                >
                                    <i className="bi bi-grid-fill"></i>
                                    <span>Heatmap</span>
                                </button>

                                {/* Round Switch Button */}
                                <button 
                                    type="button" 
                                    className={`round-toggle-switch ${vizMode === 'graph' ? 'active' : ''}`}
                                    onClick={() => setVizMode(vizMode === 'heatmap' ? 'graph' : 'heatmap')}
                                    role="switch"
                                    aria-checked={vizMode === 'graph'}
                                    title={`Switch to ${vizMode === 'heatmap' ? 'Graph view' : 'Heatmap view'}`}
                                >
                                    <span className="round-toggle-knob">
                                        <i className={`bi ${vizMode === 'graph' ? 'bi-bar-chart-fill' : 'bi-grid-fill'}`} style={{ fontSize: '0.62rem' }}></i>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`btn btn-link p-0 text-decoration-none small fw-semibold d-flex align-items-center gap-1 ${vizMode === 'graph' ? 'text-primary' : 'text-muted'}`}
                                    onClick={() => setVizMode('graph')}
                                    title="View 24-Hour Timeline Graph"
                                >
                                    <i className="bi bi-bar-chart-fill"></i>
                                    <span>Graph</span>
                                </button>
                            </div>
                        </div>

                        {/* Visualization Body */}
                        {vizMode === 'heatmap' ? (
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
                        ) : (
                            /* Graph Visualization */
                            <div>
                                {/* Graph Controls: Ranges & Badges */}
                                <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 pb-2 gap-2 border-bottom">
                                    {/* Range Filter Buttons */}
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <span className="text-muted small fw-medium me-1">Range:</span>
                                        <button
                                            type="button"
                                            className={`graph-range-pill ${graphRange === '7d' ? 'active' : ''}`}
                                            onClick={() => setGraphRange('7d')}
                                        >
                                            Last 7 Days
                                        </button>
                                        <button
                                            type="button"
                                            className={`graph-range-pill ${graphRange === '14d' ? 'active' : ''}`}
                                            onClick={() => setGraphRange('14d')}
                                        >
                                            Last 14 Days
                                        </button>
                                        <button
                                            type="button"
                                            className={`graph-range-pill ${graphRange === 'month' ? 'active' : ''}`}
                                            onClick={() => setGraphRange('month')}
                                        >
                                            This Month
                                        </button>
                                        <button
                                            type="button"
                                            className={`graph-range-pill d-inline-flex align-items-center gap-1 ${graphRange === 'custom' ? 'active' : ''}`}
                                            onClick={() => setGraphRange('custom')}
                                        >
                                            <i className="bi bi-calendar-range"></i>
                                            <span>Custom</span>
                                        </button>

                                        {/* Custom Date Pickers when 'custom' is active */}
                                        {graphRange === 'custom' && (
                                            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-body-tertiary rounded-pill border shadow-sm">
                                                <div className="d-flex align-items-center gap-1">
                                                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>From:</span>
                                                    <input
                                                        type="date"
                                                        className="form-control form-control-sm border-0 bg-transparent py-0 px-1 shadow-none fw-medium text-body"
                                                        style={{ width: '130px', fontSize: '0.78rem' }}
                                                        value={customStartDate}
                                                        max={customEndDate || new Date().toLocaleDateString('en-CA')}
                                                        onChange={(e) => handleCustomDateChange('start', e.target.value)}
                                                    />
                                                </div>
                                                <span className="text-muted small">—</span>
                                                <div className="d-flex align-items-center gap-1">
                                                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>To:</span>
                                                    <input
                                                        type="date"
                                                        className="form-control form-control-sm border-0 bg-transparent py-0 px-1 shadow-none fw-medium text-body"
                                                        style={{ width: '130px', fontSize: '0.78rem' }}
                                                        value={customEndDate}
                                                        min={customStartDate}
                                                        max={new Date().toLocaleDateString('en-CA')}
                                                        onChange={(e) => handleCustomDateChange('end', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Legend Indicators */}
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="chart-legend-badge">
                                            <span className="chart-legend-dot" style={{ backgroundColor: isDarkMode ? '#22c55e' : '#16a34a' }}></span>
                                            <span>Work Time</span>
                                        </div>
                                        <div className="chart-legend-badge">
                                            <span className="chart-legend-dot" style={{ backgroundColor: isDarkMode ? '#fbbf24' : '#d97706' }}></span>
                                            <span>Break Time</span>
                                        </div>
                                        <div className="chart-legend-badge text-muted" title="Y-axis maximum is 24 hours per day">
                                            <i className="bi bi-clock-history"></i>
                                            <span>Max 24h</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Chart Canvas */}
                                <div className="analytics-chart-wrapper">
                                    <Bar data={chartData} options={chartOptions} />
                                </div>
                            </div>
                        )}
                        
                        {/* Selected Date Stats */}
                        <div className="d-flex align-items-center justify-content-between mt-4 mb-2">
                            <h6 className="fw-bold mb-0 text-muted d-flex align-items-center gap-2">
                                <i className="bi bi-calendar-event"></i>
                                Stats for {selectedDateStats.date}
                            </h6>
                            <span className="text-muted small">
                                {vizMode === 'heatmap' ? 'Click on any cell to view day details' : 'Click or hover on any bar to inspect date'}
                            </span>
                        </div>
                        <div className="row text-center g-3 justify-content-center">
                            <div className="col-12 col-md-4">
                                <div className="p-3 bg-light rounded-4 h-100 d-flex flex-column justify-content-center border">
                                    <div className="text-muted small fw-medium text-uppercase mb-1">Tasks Done</div>
                                    <div className="fs-4 fw-bold text-info">
                                        {selectedDateStats.completed} / {selectedDateStats.total}
                                    </div>
                                    <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                        {selectedDateStats.total > 0 
                                            ? `${Math.round((selectedDateStats.completed / selectedDateStats.total) * 100)}% completed` 
                                            : 'No tasks scheduled'}
                                    </div>
                                </div>
                            </div>
                            <div className="col-6 col-md-4">
                                <div className="p-3 bg-light rounded-4 h-100 d-flex flex-column justify-content-center border">
                                    <div className="text-muted small fw-medium text-uppercase mb-1">Hours Worked</div>
                                    <div className="fs-4 fw-bold text-success">
                                        {parseFloat(selectedDateStats.hours || 0).toFixed(1)}h
                                    </div>
                                    <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                        {formatDuration(selectedDateStats.hours || 0)} focus time
                                    </div>
                                </div>
                            </div>
                            <div className="col-6 col-md-4">
                                <div className="p-3 bg-light rounded-4 h-100 d-flex flex-column justify-content-center border">
                                    <div className="text-muted small fw-medium text-uppercase mb-1">Break Time</div>
                                    <div className="fs-4 fw-bold text-warning">
                                        {formatDuration(selectedDateStats.breakHours || 0)}
                                    </div>
                                    <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                        {selectedDateStats.breakHours > 0 
                                            ? `${parseFloat(selectedDateStats.breakHours).toFixed(1)}h pause recorded` 
                                            : 'No break taken'}
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
                                <h1 className="modal-title fs-5 fw-bold">
                                    {reasonType === 'late' 
                                        ? 'Late Arrival Reason Required' 
                                        : (reasonType === 'early' 
                                            ? 'Early Departure Reason Required' 
                                            : 'Session Conclusion Reason')}
                                </h1>
                                <button type="button" className="btn-close" onClick={() => setShowReasonModal(false)}></button>
                            </div>
                            <div className="modal-body text-start">
                                {reasonError && <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">{reasonError}</div>}
                                <p className="text-muted small mb-2">
                                    {reasonType === 'late'
                                        ? 'You are starting after your scheduled start time. Please provide an explanation (min 15 words).'
                                        : (reasonType === 'early'
                                            ? 'You are ending work before completing your daily target. Please provide a reason (min 15 words).'
                                            : 'Please provide a reason or summary note for ending this work session (min 15 words).')}
                                </p>
                                <textarea
                                    className="form-control bg-body-tertiary border-0"
                                    rows="4"
                                    placeholder={
                                        reasonType === 'late' 
                                            ? 'Explain why you started work late today...' 
                                            : (reasonType === 'early' 
                                                ? 'Explain why you are ending your shift early today...' 
                                                : 'Explain your reason for ending work session today...')
                                    }
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
                                    {reasonType === 'late' ? 'Submit & Start Work' : 'Submit & End Work'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Uncheck Task Reason Modal */}
            {showUncheckModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
            )}
            {showUncheckModal && (
                <div className="modal fade show d-block" style={{ zIndex: 1070 }} tabIndex="-1" role="dialog" aria-modal="true">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header border-0 pb-0 pt-4 px-4">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-warning bg-opacity-10 text-warning p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
                                        <i className="bi bi-arrow-counterclockwise fs-5"></i>
                                    </div>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-0">Uncheck Task</h5>
                                        <p className="text-muted small mb-0">Explain why this completed task is being reopened</p>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={() => {
                                        setShowUncheckModal(false);
                                        setUncheckTodoTarget(null);
                                    }}
                                ></button>
                            </div>
                            <div className="modal-body px-4 py-3 text-start">
                                {uncheckError && (
                                    <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">
                                        {uncheckError}
                                    </div>
                                )}

                                <div className="p-3 bg-body-tertiary rounded-3 mb-3 border">
                                    <div className="text-muted small fw-medium mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Task to Reopen</div>
                                    <div className="fw-semibold text-truncate">{uncheckTodoTarget?.title}</div>
                                </div>

                                <label className="form-label small fw-semibold text-muted mb-1">
                                    Reason for Unchecking <span className="text-danger">*</span> (Minimum 10 words)
                                </label>
                                <textarea
                                    className="form-control bg-body-tertiary border"
                                    rows="4"
                                    placeholder="Write at least 10 words explaining why this completed task needs to be unchecked or reworked..."
                                    value={uncheckReason}
                                    onChange={(e) => {
                                        setUncheckReason(e.target.value);
                                        if (uncheckError && countWords(e.target.value) >= 10) {
                                            setUncheckError('');
                                        }
                                    }}
                                    autoFocus
                                ></textarea>

                                <div className="d-flex justify-content-between align-items-center mt-2">
                                    <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                        {countWords(uncheckReason) < 10 
                                            ? `${10 - countWords(uncheckReason)} more word${10 - countWords(uncheckReason) === 1 ? '' : 's'} required`
                                            : '✓ Requirement met'}
                                    </span>
                                    <span className={`small fw-bold ${countWords(uncheckReason) >= 10 ? 'text-success' : 'text-muted'}`}>
                                        {countWords(uncheckReason)} / 10 words
                                    </span>
                                </div>
                            </div>
                            <div className="modal-footer border-0 px-4 pb-4 pt-1">
                                <button 
                                    type="button" 
                                    className="btn btn-light rounded-pill px-4 fw-medium" 
                                    onClick={() => {
                                        setShowUncheckModal(false);
                                        setUncheckTodoTarget(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-warning text-dark rounded-pill px-4 fw-semibold shadow-sm"
                                    onClick={handleConfirmUncheck}
                                    disabled={countWords(uncheckReason) < 10}
                                >
                                    <i className="bi bi-check2-circle me-1"></i>
                                    Confirm & Uncheck
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Work Summary Detailed Modal */}
            <WorkSummaryModal
                isOpen={showSummaryModal}
                onClose={() => setShowSummaryModal(false)}
                summaryData={summaryData}
                onDownloadPdf={handleDownloadSummaryPDF}
                isDownloadingPdf={isDownloadingPdf}
            />
        </div>
    );
}
