import React, { useState, useEffect } from 'react';
import { API } from '../api';
import PasswordInput from './PasswordInput';

export default function AppLayout({ user, onLogout, onUpdateUser, children }) {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [showDropdown, setShowDropdown] = useState(false);

    // Modal states
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsTab, setSettingsTab] = useState('security'); // 'security', 'preferences', 'danger'

    // Profile form states
    const [firstName, setFirstName] = useState(user?.first_name || '');
    const [lastName, setLastName] = useState(user?.last_name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [avatarFile, setAvatarFile] = useState(null);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // OTP verification inside profile modal (when email changes)
    const [otpPendingEmail, setOtpPendingEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);

    // Password change states
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Work preferences states
    const [dailyHoursTarget, setDailyHoursTarget] = useState(user?.profile?.daily_hours_target || 9.0);
    const [useFixedSchedule, setUseFixedSchedule] = useState(user?.profile?.use_fixed_schedule || false);
    const [workStartTime, setWorkStartTime] = useState(user?.profile?.work_start_time || '09:00');
    const [workEndTime, setWorkEndTime] = useState(user?.profile?.work_end_time || '18:00');
    const [workDays, setWorkDays] = useState(user?.profile?.work_days ? user.profile.work_days.split(',') : []);
    const [prefError, setPrefError] = useState('');
    const [prefSuccess, setPrefSuccess] = useState('');
    const [prefLoading, setPrefLoading] = useState(false);

    // Danger zone states
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Toggle theme
    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Close dropdown on click outside
    useEffect(() => {
        const closeDropdown = () => setShowDropdown(false);
        if (showDropdown) {
            window.addEventListener('click', closeDropdown);
        }
        return () => window.removeEventListener('click', closeDropdown);
    }, [showDropdown]);

    // Profile form submission
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');
        setProfileLoading(true);

        const formData = new FormData();
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        formData.append('email', email);
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }

        try {
            const res = await API.post('/api/auth/profile/update/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data.status === 'verification_pending') {
                setOtpPendingEmail(res.data.email);
                setProfileSuccess('A verification code has been sent to your new email.');
            } else {
                setProfileSuccess('Profile updated successfully!');
                onUpdateUser();
            }
        } catch (err) {
            setProfileError(err.response?.data?.error || 'Failed to update profile.');
        } finally {
            setProfileLoading(false);
        }
    };

    // OTP verify submission for email updates
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');
        setOtpLoading(true);

        try {
            await API.post('/api/auth/profile/verify-email/', { otp: otpCode });
            setProfileSuccess('Email updated successfully!');
            setOtpPendingEmail('');
            setOtpCode('');
            onUpdateUser();
        } catch (err) {
            setProfileError(err.response?.data?.error || 'Invalid verification code.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Password change submission
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');
        setPasswordLoading(true);

        try {
            await API.post('/api/auth/profile/change-password/', {
                old_password: oldPassword,
                new_password: newPassword,
            });
            setPasswordSuccess('Password updated successfully!');
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setPasswordError(err.response?.data?.error || 'Failed to change password.');
        } finally {
            setPasswordLoading(false);
        }
    };

    // Work preferences submission
    const handlePrefSubmit = async (e) => {
        e.preventDefault();
        setPrefError('');
        setPrefSuccess('');
        setPrefLoading(true);

        try {
            await API.post('/api/auth/profile/preferences/', {
                daily_hours_target: dailyHoursTarget,
                use_fixed_schedule: useFixedSchedule,
                work_start_time: workStartTime,
                work_end_time: workEndTime,
                work_days: workDays,
            });
            setPrefSuccess('Work preferences updated successfully!');
            onUpdateUser();
        } catch (err) {
            setPrefError(err.response?.data?.error || 'Failed to save preferences.');
        } finally {
            setPrefLoading(false);
        }
    };

    // Delete account submission
    const handleDeleteAccount = async (e) => {
        e.preventDefault();
        if (!confirmDelete) return;
        setDeleteLoading(true);

        try {
            await API.post('/api/auth/profile/delete/');
            onLogout();
        } catch (err) {
            alert('Failed to delete account. Please try again.');
            setDeleteLoading(false);
        }
    };

    const toggleWorkDay = (day) => {
        setWorkDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    return (
        <div className="d-flex flex-column min-vh-100" id="wrapper">
            {/* Top Navbar */}
            <nav className="navbar navbar-expand py-3 px-4 border-bottom border-secondary-subtle bg-glass sticky-top" style={{ zIndex: 1020 }}>
                <div className="container-fluid px-0 d-flex align-items-center justify-content-between">
                    <a className="navbar-brand fs-4 fw-bold text-body d-flex align-items-center gap-2" href="#" onClick={(e) => e.preventDefault()}>
                        <img src="/favicon.png" alt="Tyqro Logo" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.src = 'https://raw.githubusercontent.com/SUMAN1040/Tyqro/main/static/img/favicon.png'; }} /> Tyqro
                    </a>
                    
                    <div className="ms-auto d-flex align-items-center">
                        {/* Profile Dropdown */}
                        <div className="dropdown me-3 position-relative">
                            <button 
                                className="btn btn-link text-body text-decoration-none dropdown-toggle d-flex align-items-center gap-2" 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                                aria-expanded={showDropdown}
                            >
                                {user?.profile?.avatar_url ? (
                                    <img src={user.profile.avatar_url} alt="Profile" className="rounded-circle" style={{ width: '24px', height: '24px', objectFit: 'cover' }} />
                                ) : (
                                    <i className="bi bi-person-circle fs-5"></i>
                                )}
                                <span className="d-none d-md-inline">{user?.first_name || user?.username}</span>
                            </button>
                            <ul className={`dropdown-menu dropdown-menu-end border-0 shadow ${showDropdown ? 'show' : ''}`} style={{ position: 'absolute', right: 0, top: '100%' }}>
                                <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); setShowProfileModal(true); setShowDropdown(false); }}><i className="bi bi-person-circle me-2"></i>Profile</a></li>
                                <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); setShowSettingsModal(true); setShowDropdown(false); }}><i className="bi bi-gear me-2"></i>Settings</a></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li>
                                    <button onClick={() => { onLogout(); setShowDropdown(false); }} className="dropdown-item text-danger"><i className="bi bi-box-arrow-right me-2"></i>Logout</button>
                                </li>
                            </ul>
                        </div>

                        {/* Theme Toggle */}
                        <button className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                            <i className={theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars'}></i>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Layout Wrapper */}
            <main className="container py-4 flex-grow-1">
                {children}
            </main>

            {/* Profile Modal */}
            {showProfileModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            {showProfileModal && (
                <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow text-start">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold"><i className="bi bi-person-circle me-2 text-primary"></i>Profile Details</h5>
                                <button type="button" className="btn-close" onClick={() => { setShowProfileModal(false); setOtpPendingEmail(''); }}></button>
                            </div>
                            
                            {!otpPendingEmail ? (
                                <form onSubmit={handleProfileSubmit}>
                                    <div className="modal-body py-4">
                                        {profileError && <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">{profileError}</div>}
                                        {profileSuccess && <div className="alert alert-success bg-success bg-opacity-10 text-success border-0 small py-2 text-center mb-3">{profileSuccess}</div>}
                                        
                                        <div className="d-flex align-items-center mb-4">
                                            <div className="me-3 position-relative">
                                                {user?.profile?.avatar_url ? (
                                                    <img src={user.profile.avatar_url} alt="Profile" className="rounded-circle" style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
                                                ) : (
                                                    <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '80px', height: '80px' }}>
                                                        <i className="bi bi-person fs-1"></i>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-grow-1">
                                                <label className="form-label mb-1 fw-medium small">Profile Picture</label>
                                                <input className="form-control form-control-sm bg-body" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} />
                                                <div className="form-text mt-1 text-muted" style={{ fontSize: '0.8rem' }}>Max size: 3MB</div>
                                            </div>
                                        </div>

                                        <div className="row g-3 mb-3">
                                            <div className="col-md-6">
                                                <label className="form-label text-muted small mb-1">First Name</label>
                                                <input type="text" className="form-control bg-body" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label text-muted small mb-1">Last Name</label>
                                                <input type="text" className="form-control bg-body" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="mb-2">
                                            <label className="form-label text-muted small mb-1">Email Address</label>
                                            <input type="email" className="form-control bg-body" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                            <div className="form-text text-warning mt-1" style={{ fontSize: '0.8rem' }}><i className="bi bi-info-circle me-1"></i>Changing email requires OTP verification.</div>
                                        </div>
                                    </div>
                                    <div className="modal-footer border-0 pt-0">
                                        <button type="button" className="btn btn-light" onClick={() => setShowProfileModal(false)}>Cancel</button>
                                        <button type="submit" className="btn btn-primary px-4 fw-medium" disabled={profileLoading}>
                                            {profileLoading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp}>
                                    <div className="modal-body py-4 text-center">
                                        {profileError && <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">{profileError}</div>}
                                        {profileSuccess && <div className="alert alert-success bg-success bg-opacity-10 text-success border-0 small py-2 text-center mb-3">{profileSuccess}</div>}

                                        <p className="small text-secondary mb-3">
                                            Enter the 6-digit verification code sent to <strong className="text-light">{otpPendingEmail}</strong>.
                                        </p>
                                        <input
                                            type="text"
                                            className="form-control text-center fw-bold fs-4 mb-3"
                                            placeholder="••••••"
                                            maxLength="6"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            style={{ letterSpacing: '0.25em' }}
                                            required
                                        />
                                    </div>
                                    <div className="modal-footer border-0 pt-0">
                                        <button type="button" className="btn btn-light" onClick={() => setOtpPendingEmail('')}>Back</button>
                                        <button type="submit" className="btn btn-primary px-4 fw-medium" disabled={otpLoading}>
                                            {otpLoading ? 'Verifying...' : 'Verify OTP'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            {showSettingsModal && (
                <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content border-0 shadow text-start">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold"><i className="bi bi-gear me-2 text-primary"></i>Account Settings</h5>
                                <button type="button" className="btn-close" onClick={() => setShowSettingsModal(false)}></button>
                            </div>
                            <div className="modal-body py-4">
                                <div className="row">
                                    {/* Modal Tabs navigation */}
                                    <div className="col-md-3 border-end">
                                        <div className="nav flex-column nav-pills me-3">
                                            <button className={`nav-link text-start py-2.5 px-3 fw-medium d-flex align-items-center gap-2 mb-2 ${settingsTab === 'security' ? 'active' : ''}`} onClick={() => setSettingsTab('security')}>
                                                <i className="bi bi-shield-lock"></i> Security
                                            </button>
                                            <button className={`nav-link text-start py-2.5 px-3 fw-medium d-flex align-items-center gap-2 mb-2 ${settingsTab === 'preferences' ? 'active' : ''}`} onClick={() => setSettingsTab('preferences')}>
                                                <i className="bi bi-sliders"></i> Preferences
                                            </button>
                                            <button className={`nav-link text-start py-2.5 px-3 fw-medium d-flex align-items-center gap-2 text-danger ${settingsTab === 'danger' ? 'active' : ''}`} onClick={() => setSettingsTab('danger')}>
                                                <i className="bi bi-exclamation-triangle"></i> Danger Zone
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Tab Content */}
                                    <div className="col-md-9 px-md-4">
                                        {/* Security Tab */}
                                        {settingsTab === 'security' && (
                                            <div>
                                                <h6 className="fw-bold mb-3 text-body">Change Password</h6>
                                                {passwordError && <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">{passwordError}</div>}
                                                {passwordSuccess && <div className="alert alert-success bg-success bg-opacity-10 text-success border-0 small py-2 text-center mb-3">{passwordSuccess}</div>}

                                                <form onSubmit={handlePasswordSubmit}>
                                                    <PasswordInput label="Current Password" id="oldPassword" name="oldPassword" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                                                    <PasswordInput label="New Password" id="newPassword" name="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                                    <div className="text-end mt-4">
                                                        <button type="submit" className="btn btn-primary px-4 fw-medium" disabled={passwordLoading}>
                                                            {passwordLoading ? 'Updating...' : 'Change Password'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}

                                        {/* Preferences Tab */}
                                        {settingsTab === 'preferences' && (
                                            <div>
                                                <h6 className="fw-bold mb-3 text-body">Work Preferences</h6>
                                                {prefError && <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 small py-2 text-center mb-3">{prefError}</div>}
                                                {prefSuccess && <div className="alert alert-success bg-success bg-opacity-10 text-success border-0 small py-2 text-center mb-3">{prefSuccess}</div>}

                                                <form onSubmit={handlePrefSubmit}>
                                                    <div className="mb-3">
                                                        <label className="form-label text-muted small mb-1">Daily Work Hours Target (Flexible Mode)</label>
                                                        <input type="number" step="0.25" min="1" max="24" className="form-control bg-body" value={dailyHoursTarget} onChange={(e) => setDailyHoursTarget(parseFloat(e.target.value))} disabled={useFixedSchedule} required />
                                                        <div className="form-text mt-1 text-muted" style={{ fontSize: '0.8rem' }}>Number of hours you target to work daily when not on a fixed schedule.</div>
                                                    </div>
                                                    
                                                    <div className="mb-3 border p-3 rounded bg-body-tertiary">
                                                        <div className="form-check mb-3">
                                                            <input className="form-check-input" type="checkbox" id="useFixedSchedule" checked={useFixedSchedule} onChange={(e) => setUseFixedSchedule(e.target.checked)} />
                                                            <label className="form-check-label small fw-bold text-body" htmlFor="useFixedSchedule">
                                                                Enable Fixed Time Schedule (Custom Start/End Times)
                                                            </label>
                                                        </div>
                                                        <div className="row g-2">
                                                            <div className="col-md-6">
                                                                <label className="form-label text-muted small mb-1">Work Start Time</label>
                                                                <input type="time" className="form-control bg-body" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} disabled={!useFixedSchedule} />
                                                            </div>
                                                            <div className="col-md-6">
                                                                <label className="form-label text-muted small mb-1">Work End Time</label>
                                                                <input type="time" className="form-control bg-body" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} disabled={!useFixedSchedule} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mb-4">
                                                        <label className="form-label text-muted small mb-2 d-block">Active Workdays</label>
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                                                <div key={day} className="form-check form-check-inline bg-light p-2 rounded border px-3 mb-2 d-flex align-items-center">
                                                                    <input className="form-check-input ms-0 me-2" type="checkbox" id={`day-${day}`} checked={workDays.includes(day)} onChange={() => toggleWorkDay(day)} />
                                                                    <label className="form-check-label small fw-medium" htmlFor={`day-${day}`}>{day}</label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="text-end">
                                                        <button type="submit" className="btn btn-primary px-4 fw-medium" disabled={prefLoading}>
                                                            {prefLoading ? 'Saving...' : 'Save Preferences'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}

                                        {/* Danger Zone Tab */}
                                        {settingsTab === 'danger' && (
                                            <div>
                                                <h6 className="fw-bold text-danger mb-3">Delete Account</h6>
                                                <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 p-3 rounded-3 small mb-4">
                                                    <h6 className="fw-bold mb-1"><i className="bi bi-exclamation-triangle-fill me-2"></i>Warning: Action cannot be undone</h6>
                                                    Permanently deleting your account will erase all your profile details, tracked sessions, todo lists, and performance analytics. This data cannot be recovered.
                                                </div>
                                                <form onSubmit={handleDeleteAccount}>
                                                    <div className="form-check mb-4">
                                                        <input className="form-check-input" type="checkbox" id="confirmDeleteCheck" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} required />
                                                        <label className="form-check-label small text-muted fw-semibold" htmlFor="confirmDeleteCheck">
                                                            I understand the consequences and want to delete my account.
                                                        </label>
                                                    </div>
                                                    <div className="text-end">
                                                        <button type="submit" className="btn btn-danger px-4 fw-medium" disabled={!confirmDelete || deleteLoading}>
                                                            {deleteLoading ? 'Deleting...' : 'Permanently Delete Account'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}