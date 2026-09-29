import React, { useState, useEffect } from 'react';
import { API } from '../api';

export default function GroupStudyModal({ 
    user, 
    groupStatus, 
    onRefreshGroup, 
    isSplitView, 
    onToggleSplitView 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('get_code'); // 'get_code', 'enter_code', 'members'
    
    // Get Code tab states
    const [myCode, setMyCode] = useState(user?.profile?.study_code || '');
    const [codeLoading, setCodeLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    
    // Enter Code tab states
    const [enterCodeInput, setEnterCodeInput] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinSuccess, setJoinSuccess] = useState('');

    // Fetch or generate lifetime study code
    const fetchMyCode = async () => {
        setCodeLoading(true);
        try {
            const res = await API.get('/api/study/code/');
            setMyCode(res.data.study_code);
            onRefreshGroup();
        } catch (err) {
            console.error('Failed to get study code:', err);
        } finally {
            setCodeLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && !myCode) {
            fetchMyCode();
        }
    }, [isOpen]);

    // Copy to clipboard
    const handleCopyCode = () => {
        if (!myCode) return;
        navigator.clipboard.writeText(myCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
    };

    // Join Group with code
    const handleJoinGroup = async (e) => {
        e.preventDefault();
        setJoinError('');
        setJoinSuccess('');
        const trimmed = enterCodeInput.trim().toUpperCase();
        if (!trimmed) {
            setJoinError('Please enter a study code.');
            return;
        }

        setJoinLoading(true);
        try {
            const res = await API.post('/api/study/join/', { code: trimmed });
            setJoinSuccess(res.data.message || 'Joined group successfully!');
            setEnterCodeInput('');
            onRefreshGroup();
            if (!isSplitView) {
                onToggleSplitView(true);
            }
            setActiveTab('members');
        } catch (err) {
            setJoinError(err.response?.data?.error || err.response?.data?.message || 'Failed to join group.');
        } finally {
            setJoinLoading(false);
        }
    };

    // Leave Group
    const handleLeaveGroup = async () => {
        if (!window.confirm('Are you sure you want to leave this study group?')) return;
        try {
            await API.post('/api/study/leave/');
            onRefreshGroup();
            if (isSplitView) {
                onToggleSplitView(false);
            }
            setActiveTab('get_code');
        } catch (err) {
            alert('Failed to leave study group.');
        }
    };

    // Remove member (Host only)
    const handleRemoveMember = async (memberId) => {
        if (!window.confirm('Remove this member from the study group?')) return;
        try {
            await API.post('/api/study/remove-member/', { user_id: memberId });
            onRefreshGroup();
        } catch (err) {
            alert('Failed to remove member.');
        }
    };

    const inGroup = Boolean(groupStatus?.in_group && groupStatus?.members?.length > 1);
    const memberCount = groupStatus?.members?.length || (groupStatus?.in_group ? 1 : 0);

    return (
        <>
            {/* Floating Action Button in Bottom Right Corner */}
            <button
                className="btn btn-primary rounded-pill group-study-fab d-flex align-items-center gap-2 py-2 px-3 fw-semibold border-0"
                onClick={() => setIsOpen(true)}
                title="Group Study Room"
                style={{
                    background: 'linear-gradient(135deg, #5e6ad2 0%, #4facfe 100%)',
                    zIndex: 1040
                }}
            >
                <i className="bi bi-people-fill fs-5"></i>
                <span className="d-none d-sm-inline">Group Study</span>
                {inGroup && (
                    <span className="badge bg-white text-dark rounded-pill px-2 py-1 shadow-sm font-monospace" style={{ fontSize: '0.75rem' }}>
                        <span className="pulse-dot me-1"></span>
                        {memberCount}/10
                    </span>
                )}
            </button>

            {/* Modal Backdrop & Dialog */}
            {isOpen && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={() => setIsOpen(false)}></div>
            )}

            {isOpen && (
                <div className="modal fade show d-block" style={{ zIndex: 1055 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden text-start">
                            {/* Header */}
                            <div className="modal-header border-0 pb-2 pt-4 px-4 bg-body-tertiary">
                                <div>
                                    <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                        <div className="p-2 rounded-3 text-white" style={{ background: 'linear-gradient(135deg, #5e6ad2 0%, #4facfe 100%)' }}>
                                            <i className="bi bi-mortarboard-fill"></i>
                                        </div>
                                        Group Study Room
                                    </h5>
                                    <p className="text-muted small mb-0 mt-1">Study and track live attendance with peers (up to 10 members)</p>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setIsOpen(false)}></button>
                            </div>

                            {/* Nav Tabs */}
                            <div className="px-4 bg-body-tertiary border-bottom border-secondary-subtle">
                                <ul className="nav nav-pills gap-2 pb-3">
                                    <li className="nav-item">
                                        <button 
                                            className={`nav-link rounded-pill btn-sm px-3 py-1 fw-medium ${activeTab === 'get_code' ? 'active' : 'text-body bg-transparent'}`}
                                            onClick={() => { setActiveTab('get_code'); setJoinError(''); setJoinSuccess(''); }}
                                        >
                                            <i className="bi bi-qr-code me-1"></i> Get Code
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button 
                                            className={`nav-link rounded-pill btn-sm px-3 py-1 fw-medium ${activeTab === 'enter_code' ? 'active' : 'text-body bg-transparent'}`}
                                            onClick={() => { setActiveTab('enter_code'); setJoinError(''); setJoinSuccess(''); }}
                                        >
                                            <i className="bi bi-box-arrow-in-right me-1"></i> Enter Code
                                        </button>
                                    </li>
                                    {groupStatus?.in_group && (
                                        <li className="nav-item">
                                            <button 
                                                className={`nav-link rounded-pill btn-sm px-3 py-1 fw-medium ${activeTab === 'members' ? 'active' : 'text-body bg-transparent'}`}
                                                onClick={() => { setActiveTab('members'); setJoinError(''); setJoinSuccess(''); }}
                                            >
                                                <i className="bi bi-people me-1"></i> Group ({memberCount}/10)
                                            </button>
                                        </li>
                                    )}
                                </ul>
                            </div>

                            {/* Body */}
                            <div className="modal-body p-4">
                                {/* TAB 1: GET CODE */}
                                {activeTab === 'get_code' && (
                                    <div className="text-center py-2">
                                        <div className="mb-3">
                                            <div className="text-muted small fw-semibold text-uppercase mb-2" style={{ letterSpacing: '0.05em' }}>
                                                Your Permanent Study Code
                                            </div>
                                            
                                            {codeLoading ? (
                                                <div className="spinner-border text-primary my-3" role="status"></div>
                                            ) : (
                                                <div className="p-3 bg-light rounded-4 border border-secondary-subtle d-flex align-items-center justify-content-between gap-3 shadow-sm mx-auto" style={{ maxWidth: '360px' }}>
                                                    <span className="fs-3 fw-bold font-monospace text-primary tracking-wide">
                                                        {myCode || 'Generating...'}
                                                    </span>
                                                    <button 
                                                        className={`btn ${copySuccess ? 'btn-success' : 'btn-outline-primary'} rounded-pill btn-sm px-3 py-2 fw-medium d-flex align-items-center gap-1`}
                                                        onClick={handleCopyCode}
                                                        disabled={!myCode}
                                                    >
                                                        <i className={`bi ${copySuccess ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
                                                        <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-muted small px-3 mt-3 mb-4">
                                            <i className="bi bi-info-circle me-1 text-primary"></i>
                                            This is your single lifetime study code. Share this code with your friends or study group members. When they enter it, they will join your shared study session!
                                        </p>

                                        {groupStatus?.in_group && (
                                            <div className="d-flex justify-content-center gap-2">
                                                <button 
                                                    className={`btn ${isSplitView ? 'btn-outline-primary' : 'btn-primary'} rounded-pill px-4 fw-medium`}
                                                    onClick={() => {
                                                        onToggleSplitView(!isSplitView);
                                                        setIsOpen(false);
                                                    }}
                                                >
                                                    <i className="bi bi-layout-split me-1"></i>
                                                    {isSplitView ? 'Hide Group Split View' : 'Open Group Split View'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: ENTER CODE */}
                                {activeTab === 'enter_code' && (
                                    <div className="py-2">
                                        <p className="text-muted small mb-3">
                                            Enter the permanent study code shared by your friend or study host to join their group room (Up to 10 peers).
                                        </p>

                                        {joinError && (
                                            <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">
                                                {joinError}
                                            </div>
                                        )}

                                        {joinSuccess && (
                                            <div className="alert alert-success bg-success bg-opacity-10 text-success border-0 small py-2 text-center mb-3">
                                                {joinSuccess}
                                            </div>
                                        )}

                                        <form onSubmit={handleJoinGroup}>
                                            <div className="input-group mb-3">
                                                <span className="input-group-text bg-light border-0 px-3">
                                                    <i className="bi bi-key text-muted"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-lg bg-light border-0 font-monospace text-uppercase fw-bold"
                                                    placeholder="TYQ-XXXXXX"
                                                    value={enterCodeInput}
                                                    onChange={(e) => setEnterCodeInput(e.target.value.toUpperCase())}
                                                    maxLength={12}
                                                    disabled={joinLoading}
                                                    autoFocus
                                                />
                                            </div>

                                            <button 
                                                type="submit" 
                                                className="btn btn-primary w-100 py-2 rounded-pill fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2"
                                                disabled={joinLoading || !enterCodeInput.trim()}
                                            >
                                                {joinLoading ? (
                                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                                ) : (
                                                    <>
                                                        <i className="bi bi-person-plus-fill"></i>
                                                        Join Study Group
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {/* TAB 3: GROUP MEMBERS */}
                                {activeTab === 'members' && groupStatus?.in_group && (
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <span className="fw-bold small text-uppercase text-muted">Group Code:</span>
                                                <span className="font-monospace fw-bold ms-2 text-primary">{groupStatus.group_code}</span>
                                            </div>
                                            <span className="badge bg-primary rounded-pill px-3 py-2 font-monospace">
                                                {memberCount} / 10 Members
                                            </span>
                                        </div>

                                        <div className="list-group list-group-flush mb-4 overflow-auto" style={{ maxHeight: '220px' }}>
                                            {groupStatus.members?.map((m) => (
                                                <div key={m.id} className="list-group-item px-0 py-2 d-flex align-items-center justify-content-between border-secondary-subtle">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="position-relative">
                                                            {m.avatar_url ? (
                                                                <img src={m.avatar_url} alt={m.full_name} className="rounded-circle" style={{ width: '36px', height: '36px', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold" style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}>
                                                                    {(m.first_name?.[0] || m.username?.[0] || 'U').toUpperCase()}
                                                                </div>
                                                            )}
                                                            <span 
                                                                className="position-absolute bottom-0 end-0 rounded-circle border border-2 border-white"
                                                                style={{ 
                                                                    width: '10px', 
                                                                    height: '10px', 
                                                                    backgroundColor: m.is_active ? '#198754' : m.is_break ? '#ffc107' : '#adb5bd' 
                                                                }}
                                                            ></span>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold small mb-0 d-flex align-items-center gap-2">
                                                                {m.full_name}
                                                                {m.is_self && <span className="badge bg-secondary-subtle text-secondary small">You</span>}
                                                                {m.is_creator && <span className="badge bg-primary-subtle text-primary small">Host</span>}
                                                            </div>
                                                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                                {m.is_active ? (
                                                                    <span className="text-success"><i className="bi bi-play-circle-fill me-1"></i>Working</span>
                                                                ) : m.is_break ? (
                                                                    <span className="text-warning"><i className="bi bi-pause-circle-fill me-1"></i>On Break</span>
                                                                ) : m.has_ended ? (
                                                                    <span className="text-secondary"><i className="bi bi-check-circle me-1"></i>Shift Ended</span>
                                                                ) : (
                                                                    <span className="text-muted">Offline</span>
                                                                )}
                                                                <span className="mx-1">•</span>
                                                                <span>Tasks: {m.completed_todos}/{m.total_todos}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(groupStatus.is_creator && !m.is_self) && (
                                                        <button 
                                                            className="btn btn-link text-danger p-0 ms-2"
                                                            title="Remove member"
                                                            onClick={() => handleRemoveMember(m.id)}
                                                        >
                                                            <i className="bi bi-x-circle fs-5"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="d-flex gap-2">
                                            <button 
                                                className={`btn ${isSplitView ? 'btn-outline-primary' : 'btn-primary'} flex-grow-1 rounded-pill py-2 fw-medium`}
                                                onClick={() => {
                                                    onToggleSplitView(!isSplitView);
                                                    setIsOpen(false);
                                                }}
                                            >
                                                <i className="bi bi-layout-split me-1"></i>
                                                {isSplitView ? 'Close Split View' : 'Open Side-by-Side View'}
                                            </button>
                                            <button 
                                                className="btn btn-outline-danger rounded-pill px-3 py-2 fw-medium"
                                                onClick={handleLeaveGroup}
                                                title="Leave Group"
                                            >
                                                <i className="bi bi-box-arrow-right me-1"></i> Leave
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
