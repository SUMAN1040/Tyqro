import React, { useState } from 'react';
import { API } from '../api';
import AuthLayout from '../components/AuthLayout';

export default function VerifyOTP({ onNavigate, navData }) {
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const user_id = navData?.user_id;
    const email = navData?.email || 'your email';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (otp.length !== 6) {
            setError('Please enter a valid 6-digit code.');
            return;
        }

        setLoading(true);
        try {
            const response = await API.post('/api/auth/verify-otp/', {
                user_id: user_id,
                otp: otp.trim(),
            });
            setSuccess('Account verified successfully! Redirecting to login...');
            setTimeout(() => {
                onNavigate('login');
            }, 2000);
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Invalid code. Please try again.';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout onNavigate={onNavigate} error={error} success={success} onDismissAlerts={() => setError('')}>
            <h3 className="text-center fw-bold text-white mb-3">Check your email</h3>
            <p className="text-secondary small text-center mb-4">
                We've sent a 6-digit verification code to <strong className="text-light">{email}</strong>.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="mb-4 text-center">
                    <label className="form-label text-secondary small fw-medium text-center d-block w-100 mb-2" htmlFor="otp">
                        Verification Code
                    </label>
                    <input
                        type="text"
                        id="otp"
                        className="form-control text-center fw-bold fs-4"
                        placeholder="••••••"
                        maxLength="6"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        style={{ letterSpacing: '0.2em' }}
                        autoFocus
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold shadow hover-lift mb-3"
                    disabled={loading || !user_id}
                >
                    {loading ? 'Verifying...' : 'Verify Code'}
                </button>
            </form>

            <p className="text-center text-secondary small mb-0">
                Back to{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} className="text-primary text-decoration-none fw-semibold">Sign in</a>
            </p>
        </AuthLayout>
    );
}
