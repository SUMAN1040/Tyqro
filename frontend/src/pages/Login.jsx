import React, { useState } from 'react';
import { API } from '../api';
import AuthLayout from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';

export default function Login({ onNavigate, onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(false);

        if (!email || !password) {
            setError('Please fill in all fields.');
            return;
        }

        setLoading(true);
        try {
            const response = await API.post('/api/auth/login/', {
                username: email.trim().lower(),
                password: password,
            });
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            onLoginSuccess();
        } catch (err) {
            const errMsg = err.response?.data?.detail || 'Invalid email or password. Please try again.';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout onNavigate={onNavigate} error={error} onDismissAlerts={() => setError('')}>
            <h3 className="text-center fw-bold text-white mb-3">Sign In</h3>
            <p className="text-secondary small text-center mb-4">Welcome back! Please enter your details.</p>
            
            <form onSubmit={handleSubmit}>
                <div className="mb-3 text-start">
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

                <PasswordInput
                    label="Password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                />

                <div className="d-flex justify-content-end mb-4">
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('forgot_password'); }} className="small text-primary text-decoration-none fw-medium">Forgot password?</a>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold shadow hover-lift mb-3"
                    disabled={loading}
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>

            <p className="text-center text-secondary small mb-0">
                Don't have an account?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('signup'); }} className="text-primary text-decoration-none fw-semibold">Sign up</a>
            </p>
        </AuthLayout>
    );
}
