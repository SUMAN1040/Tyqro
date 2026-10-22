import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../api';

export default function GroupStudyPeerPanel({
    groupStatus,
    onCloseSplitView,
    onOpenModal,
    onRefreshGroup
}) {
    const peers = useMemo(() => groupStatus?.peers || groupStatus?.members || [], [groupStatus]);
    const [selectedPeerId, setSelectedPeerId] = useState(peers[0]?.id || null);
    const [peerData, setPeerData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [liveSeconds, setLiveSeconds] = useState(0);
    const [liveBreakSeconds, setLiveBreakSeconds] = useState(0);
    const [liveNetSeconds, setLiveNetSeconds] = useState(0);

    // Keep selectedPeerId valid if peers list updates
    useEffect(() => {
        if (!selectedPeerId && peers.length > 0) {
            setSelectedPeerId(peers[0].id);
        } else if (selectedPeerId && !peers.some(p => p.id === selectedPeerId)) {
            setSelectedPeerId(peers[0]?.id || null);
        }
    }, [peers, selectedPeerId]);

    // Fetch live peer data
    const fetchPeerData = async (peerId, isInitial = false) => {
        if (!peerId) return;
        if (isInitial) setLoading(true);
        try {
            const res = await API.get(`/api/study/peer/${peerId}/`);
            setPeerData(res.data);
            setLiveSeconds(res.data.attendance?.total_seconds || 0);
            setLiveBreakSeconds(res.data.attendance?.total_break_seconds || 0);
            setLiveNetSeconds(res.data.attendance?.net_seconds || 0);
        } catch (err) {
            console.error('Failed to load peer data:', err);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Initial load when peer changes
    useEffect(() => {
        if (selectedPeerId) {
            fetchPeerData(selectedPeerId, true);
        } else {
            setPeerData(null);
        }
    }, [selectedPeerId]);

    // Background polling every 5 seconds
    useEffect(() => {
        if (!selectedPeerId) return;
        const pollInterval = setInterval(() => {
            fetchPeerData(selectedPeerId, false);
        }, 5000);
        return () => clearInterval(pollInterval);
    }, [selectedPeerId]);

    // Live ticking timers for peer if actively working
    useEffect(() => {
        const updateTimers = () => {
            if (!peerData?.attendance) return;
            const att = peerData.attendance;
            const now = new Date();
            const totalBreak = Number(att.total_break_seconds) || 0;

            if (att.is_active && att.start_time) {
                const start = new Date(att.start_time);
                const elapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
                setLiveSeconds(elapsed);

                let currentBreak = 0;
                if (att.is_break && att.current_break_start) {
                    currentBreak = Math.max(0, Math.floor((now.getTime() - new Date(att.current_break_start).getTime()) / 1000));
                }
                const accumBreak = totalBreak + currentBreak;
                setLiveBreakSeconds(accumBreak);
                setLiveNetSeconds(Math.max(0, elapsed - accumBreak));
            } else {
                setLiveSeconds(att.total_seconds || 0);
                setLiveBreakSeconds(totalBreak);
                setLiveNetSeconds(att.net_seconds || 0);
            }
        };

        updateTimers();
        const interval = setInterval(updateTimers, 1000);
        return () => clearInterval(interval);
    }, [peerData]);

    const handleRemovePeer = async (peerId, peerName, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(`Remove ${peerName || 'this person'} from your connected list?`)) return;
        try {
            await API.post('/api/study/remove-peer/', { user_id: peerId });
            if (onRefreshGroup) onRefreshGroup();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove person.');
        }
    };

    const formatTime = (totalSecs) => {
        const safeSecs = Math.max(0, Math.floor(totalSecs || 0));
        const hrs = String(Math.floor(safeSecs / 3600)).padStart(2, '0');
        const mins = String(Math.floor((safeSecs % 3600) / 60)).padStart(2, '0');
        const secs = String(Math.floor(safeSecs % 60)).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    // If no peers connected yet
    if (peers.length === 0) {
        return (
            <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center d-flex flex-column justify-content-center align-items-center">
                <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-circle mb-3">
                    <i className="bi bi-people-fill fs-1"></i>
                </div>
                <h5 className="fw-bold mb-2">Connected Peers</h5>
                <p className="text-muted small mb-4" style={{ maxWidth: '340px' }}>
                    Connect with up to 10 peers by entering their study code to view their real-time attendance and tasks side-by-side!
                </p>
                <div className="d-flex gap-2">
                    <button className="btn btn-primary rounded-pill px-4 fw-medium" onClick={onOpenModal}>
                        <i className="bi bi-person-plus me-1"></i> Connect Peer
                    </button>
                    <button className="btn btn-outline-secondary rounded-pill px-3" onClick={onCloseSplitView}>
                        Close Side View
                    </button>
                </div>
            </div>
        );
    }

    const completedTodos = peerData?.todos_completed || 0;
    const totalTodos = peerData?.todos_total || 0;
    const todoProgress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    const targetHours = peerData?.user?.daily_target || 9.0;
    const netHours = (liveNetSeconds / 3600);
    const hoursProgress = Math.min(100, Math.round((netHours / targetHours) * 100));

    return (
        <div className="d-flex flex-column gap-3 h-100 text-start">
            {/* Header & Peer Switcher Tabs */}
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-glass">
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 fw-semibold">
                            <i className="bi bi-people-fill me-1"></i>
                            Connected Peers: {peers.length}/10
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            className="btn btn-sm btn-outline-secondary rounded-pill px-2 py-1"
                            onClick={() => fetchPeerData(selectedPeerId, true)}
                            title="Refresh peer status"
                        >
                            <i className="bi bi-arrow-clockwise"></i>
                        </button>
                        <button
                            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1"
                            onClick={onOpenModal}
                        >
                            <i className="bi bi-person-plus me-1"></i> Add Person
                        </button>
                        <button
                            className="btn btn-sm btn-outline-danger rounded-pill px-2 py-1"
                            onClick={onCloseSplitView}
                            title="Close side view"
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Peer Selection Tabs (Up to 10 members) */}
                <div className="d-flex gap-2 overflow-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                    {peers.map((p) => {
                        const isSelected = p.id === selectedPeerId;
                        return (
                            <div
                                key={p.id}
                                className={`peer-tab-item rounded-pill px-3 py-1 d-flex align-items-center gap-2 bg-light position-relative ${isSelected ? 'active bg-primary bg-opacity-10 border border-primary' : 'border'}`}
                                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                onClick={() => setSelectedPeerId(p.id)}
                            >
                                <div className="position-relative">
                                    {p.avatar_url ? (
                                        <img src={p.avatar_url} alt={p.full_name} className="rounded-circle" style={{ width: '24px', height: '24px', objectFit: 'cover' }} />
                                    ) : (
                                        <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}>
                                            {(p.first_name?.[0] || p.username?.[0] || 'U').toUpperCase()}
                                        </div>
                                    )}
                                    <span
                                        className="position-absolute bottom-0 end-0 rounded-circle border border-1 border-white"
                                        style={{
                                            width: '7px',
                                            height: '7px',
                                            backgroundColor: p.is_active ? '#198754' : p.is_break ? '#ffc107' : '#adb5bd'
                                        }}
                                    ></span>
                                </div>
                                <span className="small fw-semibold text-truncate" style={{ maxWidth: '90px' }}>
                                    {p.first_name || p.username}
                                </span>

                                {/* Cross remove button */}
                                <button
                                    className="btn btn-link text-danger p-0 ms-1"
                                    style={{ fontSize: '0.8rem', lineHeight: 1 }}
                                    title={`Remove ${p.full_name}`}
                                    onClick={(e) => handleRemovePeer(p.id, p.full_name, e)}
                                >
                                    <i className="bi bi-x"></i>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Peer Live Status Card */}
            {loading ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center flex-grow-1 d-flex align-items-center justify-content-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading peer...</span>
                    </div>
                </div>
            ) : peerData ? (
                <div className="d-flex flex-column gap-3 flex-grow-1">
                    {/* Peer Profile Header Card */}
                    <div className="card border-0 shadow-sm rounded-4 p-4">
                        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-3">
                                {peerData.user.avatar_url ? (
                                    <img src={peerData.user.avatar_url} alt={peerData.user.full_name} className="rounded-circle shadow-sm" style={{ width: '52px', height: '52px', objectFit: 'cover' }} />
                                ) : (
                                    <div className="rounded-circle bg-gradient text-white d-flex align-items-center justify-content-center fw-bold fs-4 shadow-sm" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                                        {(peerData.user.first_name?.[0] || peerData.user.username?.[0] || 'U').toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <h5 className="fw-bold mb-0 text-body">{peerData.user.full_name}</h5>
                                    <div className="text-muted small">@{peerData.user.username}</div>
                                </div>
                            </div>

                            <div className="d-flex flex-column align-items-end gap-1">
                                {peerData.attendance.is_active ? (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-1 shadow-sm">
                                        <span className="pulse-dot me-1"></span> Currently Working
                                    </span>
                                ) : peerData.attendance.is_break ? (
                                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-1 shadow-sm">
                                        <i className="bi bi-cup-hot-fill me-1"></i> On Break
                                    </span>
                                ) : peerData.attendance.has_ended ? (
                                    <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-3 py-2 fw-semibold shadow-sm">
                                        <i className="bi bi-check-circle-fill me-1"></i> Shift Ended
                                    </span>
                                ) : (
                                    <span className="badge bg-body-tertiary text-muted border rounded-pill px-3 py-2 fw-semibold shadow-sm">
                                        <i className="bi bi-moon-fill me-1"></i> Not Started Today
                                    </span>
                                )}
                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                    <i className="bi bi-shield-lock me-1"></i> Read-Only View
                                </span>
                            </div>
                        </div>

                        {/* Live Timer Stats Display */}
                        <div className="row g-2 text-center mb-3">
                            <div className="col-4">
                                <div className="p-3 bg-light rounded-4 border border-secondary-subtle h-100">
                                    <div className="text-muted small fw-medium text-uppercase mb-1" style={{ fontSize: '0.7rem' }}>Total Time</div>
                                    <div className="fs-5 fw-bold font-monospace text-primary">
                                        {formatTime(liveSeconds)}
                                    </div>
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="p-3 bg-light rounded-4 border border-secondary-subtle h-100">
                                    <div className="text-muted small fw-medium text-uppercase mb-1" style={{ fontSize: '0.7rem' }}>Break Time</div>
                                    <div className="fs-5 fw-bold font-monospace text-warning">
                                        {formatTime(liveBreakSeconds)}
                                    </div>
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="p-3 bg-light rounded-4 border border-secondary-subtle h-100">
                                    <div className="text-muted small fw-medium text-uppercase mb-1" style={{ fontSize: '0.7rem' }}>Net Work</div>
                                    <div className="fs-5 fw-bold font-monospace text-success">
                                        {formatTime(liveNetSeconds)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Daily Target Progress Bar */}
                        <div className="bg-light p-3 rounded-4 border border-secondary-subtle">
                            <div className="d-flex justify-content-between align-items-center mb-1 small">
                                <span className="text-muted fw-medium">Daily Target Progress</span>
                                <span className="fw-bold font-monospace">{netHours.toFixed(1)} / {targetHours.toFixed(1)} hrs ({hoursProgress}%)</span>
                            </div>
                            <div className="progress rounded-pill" style={{ height: '8px' }}>
                                <div
                                    className="progress-bar progress-bar-striped progress-bar-animated bg-success rounded-pill"
                                    role="progressbar"
                                    style={{ width: `${hoursProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Peer's Today's Todo List (Read-Only) */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="fw-bold mb-0 text-body">Today's Todo List</h6>
                                <span className="badge bg-secondary-subtle text-secondary rounded-pill small" style={{ fontSize: '0.7rem' }}>
                                    Read-Only
                                </span>
                            </div>
                            <span className="badge bg-primary rounded-pill px-3 py-1 font-monospace">
                                {completedTodos}/{totalTodos} Done ({todoProgress}%)
                            </span>
                        </div>

                        {/* Tasks Progress */}
                        {totalTodos > 0 && (
                            <div className="progress rounded-pill mb-3" style={{ height: '6px' }}>
                                <div
                                    className="progress-bar bg-info rounded-pill"
                                    role="progressbar"
                                    style={{ width: `${todoProgress}%` }}
                                ></div>
                            </div>
                        )}

                        {/* Tasks List */}
                        <div className="todo-list overflow-auto flex-grow-1" style={{ maxHeight: '280px' }}>
                            {peerData.todos?.length === 0 ? (
                                <div className="text-center text-muted py-4 small">
                                    <i className="bi bi-journal-text fs-3 mb-1 d-block opacity-50"></i>
                                    No tasks planned by this peer for today.
                                </div>
                            ) : (
                                peerData.todos.map((t) => (
                                    <div
                                        key={t.id}
                                        className="todo-item d-flex align-items-center justify-content-between p-2 mb-2 rounded-3 bg-light border border-secondary-subtle"
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <i className={`bi ${t.is_completed ? 'bi-check-circle-fill text-success fs-5' : 'bi-circle text-muted fs-5'}`}></i>
                                            <span className={`todo-text ${t.is_completed ? 'completed text-decoration-line-through text-muted' : 'fw-medium'}`}>
                                                {t.title}
                                            </span>
                                        </div>
                                        <span className="badge bg-light text-muted small border">
                                            {t.is_completed ? 'Completed' : 'Pending'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
