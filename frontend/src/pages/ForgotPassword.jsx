import React, { useState } from 'react';
import { API } from '../api';
import AuthLayout from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';

export default function ForgotPassword({ onNavigate }) {
    const [step, setStep] = useState(1); // 1: request code, 2: reset password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendCode = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!email) {
            setError('Please enter your email.');
            return;
        }

        setLoading(true);
        try {
            await API.post('/api/auth/forgot-password/', { email: email.trim().toLowerCase() });
            setSuccess('We have sent a verification code to your email.');
            setStep(2);
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Email address not registered.';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!otp || !newPassword) {
            setError('All fields are required.');
            return;
        }

        setLoading(true);
        try {
            await API.post('/api/auth/forgot-password/reset/', {
                email: email.trim().toLowerCase(),
                otp: otp.trim(),
                new_password: newPassword,
            });
            setSuccess('Password has been reset successfully! Redirecting to login...');
            setTimeout(() => {
                onNavigate('login');
            }, 2000);
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Failed to reset password. Check the code and try again.';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout onNavigate={onNavigate} error={error} success={success} onDismissAlerts={() => setError('')}>
            {step === 1 ? (
                <>
                    <h3 className="text-center fw-bold text-white mb-3">Reset Password</h3>
                    <p className="text-secondary small text-center mb-4">
                        Enter your registered email address and we'll send you a verification code.
                    </p>
                    
                    <form onSubmit={handleSendCode}>
                        <div className="mb-4 text-start">
                            <label className="form-label text-secondary small fw-medium" htmlFor="email">Email address</label>
                            <input
                                type="email"
                                id="email"
                                className="form-control"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold shadow hover-lift mb-3"
                            disabled={loading}
                        >
                            {loading ? 'Sending Code...' : 'Send Verification Code'}
                        </button>
                    </form>
                </>
            ) : (
                <>
                    <h3 className="text-center fw-bold text-white mb-3">Set New Password</h3>
                    <p className="text-secondary small text-center mb-4">
                        Enter the 6-digit code sent to <strong className="text-light">{email}</strong> and set a new password.
                    </p>
                    
                    <form onSubmit={handleResetPassword}>
                        <div className="mb-3 text-start">
                            <label className="form-label text-secondary small fw-medium text-center d-block w-100 mb-1" htmlFor="otp">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                id="otp"
                                className="form-control text-center fw-bold fs-5"
                                placeholder="••••••"
                                maxLength="6"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                style={{ letterSpacing: '0.15em' }}
                                required
                            />
                        </div>

                        <PasswordInput
                            label="New Password"
                            id="newPassword"
                            name="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                        />

                        <button
                            type="submit"
                            className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold shadow hover-lift mb-3 mt-2"
                            disabled={loading}
                        >
                            {loading ? 'Resetting Password...' : 'Reset Password'}
                        </button>
                    </form>
                </>
            )}

            <p className="text-center text-secondary small mb-0">
                Back to{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} className="text-primary text-decoration-none fw-semibold">Sign in</a>
            </p>
        </AuthLayout>
    );
}
