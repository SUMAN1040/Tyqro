import React, { useState, useEffect } from 'react';
import { API } from '../api';

export default function GroupStudyPeerPanel({ 
    user, 
    groupStatus, 
    onCloseSplitView,
    onOpenModal
}) {
    const peers = (groupStatus?.members || []).filter(m => !m.is_self);
    const [selectedPeerId, setSelectedPeerId] = useState(peers[0]?.id || null);
    const [peerData, setPeerData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [liveSeconds, setLiveSeconds] = useState(0);

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

    // Live ticking timer for peer if actively working
    useEffect(() => {
        const interval = setInterval(() => {
            if (peerData?.attendance?.is_active && peerData?.attendance?.start_time) {
                const now = new Date();
                const start = new Date(peerData.attendance.start_time);
                const elapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
                setLiveSeconds(elapsed);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [peerData]);

    const formatTime = (totalSecs) => {
        const safeSecs = Math.max(0, Math.floor(totalSecs || 0));
        const hrs = String(Math.floor(safeSecs / 3600)).padStart(2, '0');
        const mins = String(Math.floor((safeSecs % 3600) / 60)).padStart(2, '0');
        const secs = String(Math.floor(safeSecs % 60)).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    const selectedPeer = peers.find(p => p.id === selectedPeerId);

    // If no peers yet in group
    if (peers.length === 0) {
        return (
            <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center d-flex flex-column justify-content-center align-items-center">
                <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-circle mb-3">
                    <i className="bi bi-people-fill fs-1"></i>
                </div>
                <h5 className="fw-bold mb-2">Group Study Room</h5>
                <p className="text-muted small mb-4" style={{ maxWidth: '320px' }}>
                    You are in room <strong className="font-monospace text-primary">{groupStatus?.group_code}</strong>. Share your study code to invite up to 9 more peers!
                </p>
                <div className="d-flex gap-2">
                    <button className="btn btn-primary rounded-pill px-4 fw-medium" onClick={onOpenModal}>
                        <i className="bi bi-qr-code me-1"></i> View / Share Code
                    </button>
                    <button className="btn btn-outline-secondary rounded-pill px-3" onClick={onCloseSplitView}>
                        Close Split View
                    </button>
                </div>
            </div>
        );
    }

    const completedTodos = peerData?.todos_completed || 0;
    const totalTodos = peerData?.todos_total || 0;
    const todoProgress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

    return (
        <div className="d-flex flex-column gap-3 h-100">
            {/* Header & Peer Switcher Tabs */}
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-glass">
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 fw-semibold font-monospace">
                            <i className="bi bi-mortarboard-fill me-1"></i>
                            Room: {groupStatus?.group_code}
                        </span>
                        <span className="badge bg-body-tertiary text-muted rounded-pill px-2 py-1 small border">
                            {peers.length + 1}/10 Members
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
                            <i className="bi bi-person-plus me-1"></i> Invite
                        </button>
                        <button 
                            className="btn btn-sm btn-outline-danger rounded-pill px-2 py-1"
                            onClick={onCloseSplitView}
                            title="Close split screen"
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
                                className={`peer-tab-item rounded-pill px-3 py-1 d-flex align-items-center gap-2 bg-light ${isSelected ? 'active bg-primary bg-opacity-10' : ''}`}
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
                                <span className="small fw-semibold text-truncate" style={{ maxWidth: '100px' }}>
                                    {p.first_name || p.username}
                                </span>
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
                                    <i className="bi bi-eye me-1"></i> Read-Only View
                                </span>
                            </div>
                        </div>

                        {/* Peer Live Attendance */}
                        <div className="p-3 bg-light rounded-4 border border-secondary-subtle text-center mb-3">
                            <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ letterSpacing: '0.05em' }}>
                                {peerData.attendance.is_break ? "Peer's Active Break" : "Peer's Total Work Time"}
                            </div>
                            <div className="display-5 fw-bold text-primary font-monospace mb-2">
                                {formatTime(liveSeconds)}
                            </div>

                            <div className="row g-2 mt-2">
                                <div className="col-6">
                                    <div className="p-2 bg-warning-subtle text-warning border border-warning-subtle rounded-3 text-center">
                                        <div className="small fw-semibold text-uppercase" style={{ fontSize: '0.7rem' }}>
                                            <i className="bi bi-cup-hot me-1"></i> Break Time
                                        </div>
                                        <div className="font-monospace fw-bold small">
                                            {formatTime(peerData.attendance.total_break_seconds)}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-2 bg-success-subtle text-success border border-success-subtle rounded-3 text-center">
                                        <div className="small fw-semibold text-uppercase" style={{ fontSize: '0.7rem' }}>
                                            <i className="bi bi-briefcase me-1"></i> Net Work
                                        </div>
                                        <div className="font-monospace fw-bold small">
                                            {formatTime(peerData.attendance.net_seconds)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Peer's Today's Todo List (Read-Only) */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h6 className="fw-bold mb-0 text-body d-flex align-items-center gap-2">
                                    <i className="bi bi-check2-circle text-primary"></i>
                                    {peerData.user.first_name || peerData.user.username}'s Today's Tasks
                                </h6>
                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                    Live synchronized (Read-only)
                                </span>
                            </div>
                            <span className="badge bg-primary rounded-pill px-3 py-1 font-monospace">
                                {completedTodos}/{totalTodos} Done
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="progress mb-3 rounded-pill" style={{ height: '6px' }}>
                            <div 
                                className="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                                role="progressbar" 
                                style={{ width: `${todoProgress}%` }}
                                aria-valuenow={todoProgress} 
                                aria-valuemin="0" 
                                aria-valuemax="100"
                            ></div>
                        </div>

                        {/* Tasks list */}
                        <div className="todo-list flex-grow-1 overflow-auto" style={{ maxHeight: '220px' }}>
                            {peerData.todos.length === 0 ? (
                                <div className="text-center text-muted py-4 small">
                                    <i className="bi bi-card-checklist fs-3 d-block mb-2 opacity-50"></i>
                                    No tasks added by peer for today yet.
                                </div>
                            ) : (
                                peerData.todos.map((todo) => (
                                    <div 
                                        key={todo.id} 
                                        className="peer-todo-item d-flex align-items-center justify-content-between p-2 mb-1 rounded-3 border-bottom border-secondary-subtle"
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <input
                                                type="checkbox"
                                                className="form-check-input todo-checkbox"
                                                checked={todo.is_completed}
                                                disabled
                                                readOnly
                                                style={{ cursor: 'not-allowed', opacity: 0.85 }}
                                            />
                                            <span 
                                                className={`todo-text ${todo.is_completed ? 'completed text-decoration-line-through text-muted' : 'text-body'}`}
                                            >
                                                {todo.title}
                                            </span>
                                        </div>
                                        {todo.is_completed && (
                                            <span className="badge bg-success-subtle text-success small px-2 py-1 rounded-pill" style={{ fontSize: '0.7rem' }}>
                                                <i className="bi bi-check-lg me-1"></i> Completed
                                            </span>
                                        )}
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
