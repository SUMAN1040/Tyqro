import React from 'react';

const formatClock = (isoStr) => {
    if (!isoStr) return '--:--';
    try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch {
        return '--:--';
    }
};

const WorkSummaryModal = ({ isOpen, onClose, summaryData, onDownloadPdf, isDownloadingPdf }) => {
    if (!isOpen || !summaryData) return null;

    const {
        report_id,
        date_formatted,
        date,
        user,
        schedule,
        attendance,
        tasks,
        performance,
        security,
        generated_at,
    } = summaryData;

    const gradeVariant = performance?.badge_variant || 'primary';
    const gradeText = performance?.shift_grade || 'Completed';

    return (
        <>
            <div 
                className="modal-backdrop fade show" 
                style={{ zIndex: 1060 }}
                onClick={onClose}
            ></div>
            <div 
                className="modal fade show d-block" 
                style={{ zIndex: 1070 }} 
                tabIndex="-1" 
                role="dialog" 
                aria-modal="true"
            >
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                    <div 
                        className="modal-content border-0 shadow-lg rounded-4 overflow-hidden"
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                        onCopy={(e) => {
                            e.preventDefault();
                            alert("This work summary report is cryptographically protected against copying.");
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        
                        {/* Modal Header */}
                        <div className="modal-header border-bottom border-secondary-subtle px-4 py-3 bg-body-tertiary d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-3 min-w-0">
                                <div className="p-2 bg-primary-subtle text-primary rounded-3 d-flex align-items-center justify-content-center flex-shrink-0">
                                    <i className="bi bi-file-earmark-text-fill fs-5"></i>
                                </div>
                                <div className="min-w-0">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <h5 className="modal-title fw-bold mb-0">Daily Work Summary</h5>
                                        <span className={`badge rounded-pill text-bg-${gradeVariant} px-2.5 py-1 small`}>
                                            {gradeText}
                                        </span>
                                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill d-none d-sm-inline-flex align-items-center gap-1.5 py-1 px-2.5 small">
                                            <i className="bi bi-shield-check"></i>
                                            <span>Verified Audit Trail</span>
                                        </span>
                                    </div>
                                    <div className="text-muted small text-truncate mt-0.5">
                                        {date_formatted || date} • Report #{report_id || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="btn-close flex-shrink-0" 
                                style={{ 
                                    margin: 0, 
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    opacity: 0.85
                                }} 
                                onClick={onClose} 
                                aria-label="Close"
                            ></button>
                        </div>

                        {/* Modal Body */}
                        <div 
                            className="modal-body p-4 position-relative"
                            style={{ 
                                overflowY: 'auto', 
                                maxHeight: 'calc(88vh - 135px)',
                                scrollBehavior: 'smooth'
                            }}
                        >
                            {/* Security tiled watermark in white area */}
                            <div 
                                className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none user-select-none" 
                                style={{
                                    zIndex: 0,
                                    opacity: 0.05,
                                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='110' viewBox='0 0 220 110'><text x='30' y='50' fill='%2364748b' font-size='12' font-family='sans-serif' font-weight='bold' transform='rotate(-25 30 50)'>TYQRO VERIFIED</text><text x='140' y='95' fill='%2364748b' font-size='11' font-family='sans-serif' font-weight='bold' transform='rotate(-25 140 95)'>DO NOT COPY</text></svg>")`,
                                    backgroundRepeat: 'repeat',
                                    pointerEvents: 'none',
                                }}
                            ></div>

                            <div className="position-relative" style={{ zIndex: 1 }}>
                            
                            {/* Member / Shift Profile Info Banner */}
                            <div className="p-3 bg-body-secondary rounded-3 mb-4">
                                <div className="row g-3 align-items-center">
                                    <div className="col-md-6 col-12">
                                        <div className="d-flex align-items-center gap-2">
                                            <i className="bi bi-person-circle fs-4 text-primary"></i>
                                            <div>
                                                <div className="fw-bold">{user?.full_name || 'Member'}</div>
                                                <div className="text-muted small">
                                                    {user?.username && user?.username !== user?.email ? `@${user.username} • ` : ''}
                                                    {user?.email}
                                                    {user?.study_code && ` • Code: ${user.study_code}`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6 col-12 text-md-end text-start">
                                        <div className="small fw-semibold text-uppercase text-muted">Schedule Mode</div>
                                        <div className="small fw-medium">
                                            {schedule?.use_fixed_schedule
                                                ? `Fixed Shift (${schedule?.work_start_time?.slice(0, 5)} - ${schedule?.work_end_time?.slice(0, 5)})`
                                                : `Flexible Shift (${schedule?.daily_target_hours || 9}h Target)`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* KPI Metrics Grid */}
                            <div className="row g-3 mb-4">
                                {/* Net Work */}
                                <div className="col-sm-6 col-lg-3">
                                    <div className="p-3 border border-success-subtle bg-success-subtle rounded-3 h-100">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="small fw-semibold text-uppercase text-success">Net Work</span>
                                            <i className="bi bi-briefcase-fill text-success"></i>
                                        </div>
                                        <div className="fs-4 fw-bold font-monospace text-success">
                                            {attendance?.net_formatted || '00h 00m 00s'}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            Target: {schedule?.daily_target_hours}h ({attendance?.target_completion_pct}%)
                                        </div>
                                    </div>
                                </div>

                                {/* Break Duration */}
                                <div className="col-sm-6 col-lg-3">
                                    <div className="p-3 border border-warning-subtle bg-warning-subtle rounded-3 h-100">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="small fw-semibold text-uppercase text-warning">Break Time</span>
                                            <i className="bi bi-cup-hot-fill text-warning"></i>
                                        </div>
                                        <div className="fs-4 fw-bold font-monospace text-warning">
                                            {attendance?.break_formatted || '00h 00m 00s'}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            Gross: {attendance?.gross_formatted || '00h 00m'}
                                        </div>
                                    </div>
                                </div>

                                {/* Tasks Completed */}
                                <div className="col-sm-6 col-lg-3">
                                    <div className="p-3 border border-primary-subtle bg-primary-subtle rounded-3 h-100">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="small fw-semibold text-uppercase text-primary">Tasks</span>
                                            <i className="bi bi-check2-circle text-primary"></i>
                                        </div>
                                        <div className="fs-4 fw-bold font-monospace text-primary">
                                            {tasks?.completed || 0} / {tasks?.total || 0}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            {tasks?.completion_rate || 0}% Completed
                                        </div>
                                    </div>
                                </div>

                                {/* Performance Points */}
                                <div className="col-sm-6 col-lg-3">
                                    <div className="p-3 border border-info-subtle bg-info-subtle rounded-3 h-100">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="small fw-semibold text-uppercase text-info">Points</span>
                                            <i className="bi bi-trophy-fill text-info"></i>
                                        </div>
                                        <div className="fs-4 fw-bold font-monospace text-info">
                                            {performance?.total_points || 0} pts
                                        </div>
                                        <div className="small text-muted mt-1">
                                            Att: {performance?.attendance_points} | Todo: {performance?.todo_points}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Session Timeline Details */}
                            <div className="card border-0 bg-body-tertiary rounded-3 p-3 mb-4">
                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-clock-history text-primary"></i> Shift Timeline Details
                                </h6>
                                <div className="row g-3 text-center">
                                    <div className="col-6 col-md">
                                        <div className="text-muted small text-uppercase">Clock In</div>
                                        <div className="fw-bold font-monospace">{formatClock(attendance?.start_time)}</div>
                                    </div>
                                    <div className="col-6 col-md">
                                        <div className="text-muted small text-uppercase">Clock Out</div>
                                        <div className="fw-bold font-monospace">{formatClock(attendance?.end_time)}</div>
                                    </div>
                                    <div className="col-4 col-md">
                                        <div className="text-muted small text-uppercase">Gross Time</div>
                                        <div className="fw-bold font-monospace">{attendance?.gross_formatted}</div>
                                    </div>
                                    <div className="col-4 col-md">
                                        <div className="text-muted small text-uppercase">Break Time</div>
                                        <div className="fw-bold font-monospace">{attendance?.break_formatted}</div>
                                    </div>
                                    <div className="col-4 col-md">
                                        <div className="text-muted small text-uppercase">Net Time</div>
                                        <div className="fw-bold font-monospace text-success">{attendance?.net_formatted}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Exception Callouts (Late / End Reason) */}
                            {(attendance?.late_reason || attendance?.early_leave_reason || attendance?.end_reason) && (
                                <div className="mb-4">
                                    {(attendance?.early_leave_reason || attendance?.end_reason) && (
                                        <div className="card border-danger-subtle bg-danger-subtle rounded-3 p-3 mb-3 shadow-sm">
                                            <div className="d-flex align-items-center gap-2 mb-2 text-danger">
                                                <i className="bi bi-chat-quote-fill fs-5"></i>
                                                <h6 className="fw-bold mb-0">
                                                    {attendance?.target_achieved ? 'Session Conclusion Reason / Note' : 'Early Departure Reason'}
                                                </h6>
                                            </div>
                                            <div 
                                                className="p-3 bg-body rounded-2 border border-danger-subtle text-body small"
                                                style={{ maxHeight: '130px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                            >
                                                "{attendance.early_leave_reason || attendance.end_reason}"
                                            </div>
                                        </div>
                                    )}
                                    {attendance?.late_reason && (
                                        <div className="card border-warning-subtle bg-warning-subtle rounded-3 p-3 mb-2 shadow-sm">
                                            <div className="d-flex align-items-center gap-2 mb-2 text-warning-emphasis">
                                                <i className="bi bi-alarm-fill fs-5 text-warning"></i>
                                                <h6 className="fw-bold mb-0">Late Arrival Reason</h6>
                                            </div>
                                            <div 
                                                className="p-3 bg-body rounded-2 border border-warning-subtle text-body small"
                                                style={{ maxHeight: '130px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                            >
                                                "{attendance.late_reason}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Task Breakdown Section */}
                            <div className="card border-0 bg-body-tertiary rounded-3 p-3">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                                        <i className="bi bi-list-task text-primary"></i> Tasks Breakdown
                                    </h6>
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2.5 py-1">
                                            {tasks?.completed || 0} / {tasks?.total || 0} Completed
                                        </span>
                                        <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-1">
                                            {tasks?.completion_rate || 0}%
                                        </span>
                                    </div>
                                </div>

                                {(!tasks?.list || tasks.list.length === 0) ? (
                                    <div className="text-center text-muted py-4 small bg-body rounded-3 border">
                                        <i className="bi bi-inbox fs-3 d-block text-muted mb-1 opacity-50"></i>
                                        No tasks were logged for this date.
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-2">
                                        {tasks.list.map((task, idx) => (
                                            <div 
                                                key={task.id || idx} 
                                                className="p-3 bg-body rounded-3 border border-secondary-subtle d-flex flex-column gap-2 shadow-xs"
                                            >
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <div className="d-flex align-items-center gap-2.5 min-w-0">
                                                        <span className="badge bg-secondary-subtle text-secondary font-monospace rounded-pill small" style={{ fontSize: '0.72rem' }}>
                                                            #{idx + 1}
                                                        </span>
                                                        <div className="d-flex align-items-center gap-2 min-w-0">
                                                            <i 
                                                                className={`bi ${task.is_completed ? 'bi-check-circle-fill text-success fs-5' : 'bi-circle text-muted fs-5'}`}
                                                            ></i>
                                                            <span className="fw-medium text-body text-break">
                                                                {task.title}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className={`badge rounded-pill flex-shrink-0 px-2.5 py-1.5 ${task.is_completed ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'}`}>
                                                        {task.is_completed ? 'Completed' : 'Pending'}
                                                    </span>
                                                </div>

                                                {/* Reopen note */}
                                                {task.uncheck_reason && (
                                                    <div className="ms-4 p-2.5 bg-danger-subtle text-danger border border-danger-subtle rounded-3 small">
                                                        <div className="d-flex align-items-center gap-1.5 fw-semibold mb-1">
                                                            <i className="bi bi-arrow-counterclockwise"></i>
                                                            <span>Reopened Note:</span>
                                                        </div>
                                                        <div className="fst-italic text-break">
                                                            "{task.uncheck_reason.trim()}"
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                        <div className="modal-footer border-top border-secondary-subtle px-4 py-3 bg-body-tertiary d-flex justify-content-between align-items-center">
                            <div className="text-muted small font-monospace">
                                <div className="fw-semibold text-body d-flex align-items-center gap-1">
                                    <i className="bi bi-fingerprint text-primary"></i>
                                    <span>{security?.security_hash || `TYQ-${report_id}`}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem' }} className="text-muted">
                                    Generated: {new Date(generated_at || Date.now()).toLocaleTimeString()} • Authenticated Audit Trail
                                </div>
                            </div>
                            <div className="d-flex gap-2">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary rounded-pill px-4" 
                                    onClick={onClose}
                                >
                                    Close
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-success rounded-pill px-4 d-flex align-items-center gap-2 shadow-sm"
                                    onClick={onDownloadPdf}
                                    disabled={isDownloadingPdf}
                                >
                                    {isDownloadingPdf ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            Preparing PDF...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-file-earmark-pdf-fill"></i>
                                            Download PDF
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
};

export default WorkSummaryModal;
