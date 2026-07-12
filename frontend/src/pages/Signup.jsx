import React, { useState } from 'react';
import { API } from '../api';
import AuthLayout from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';

export default function Signup({ onNavigate }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== passwordConfirm) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const response = await API.post('/api/auth/signup/', {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim().lower(),
                password: password,
                password_confirm: passwordConfirm,
            });
            onNavigate('verify_otp', { user_id: response.data.user_id, email: email.trim().lower() });
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Registration failed. Please check your inputs.';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout onNavigate={onNavigate} error={error} onDismissAlerts={() => setError('')}>
            <h3 className="text-center fw-bold text-white mb-2">Create Account</h3>
            <p className="text-center text-secondary small mb-4">Join thousands of productive professionals.</p>
            
            <form onSubmit={handleSubmit}>
                <div className="row g-2 mb-3 text-start">
                    <div className="col-6">
                        <label className="form-label text-secondary small fw-medium" htmlFor="firstName">First name</label>
                        <input
                            type="text"
                            id="firstName"
                            className="form-control"
                            placeholder="John"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="col-6">
                        <label className="form-label text-secondary small fw-medium" htmlFor="lastName">Last name</label>
                        <input
                            type="text"
                            id="lastName"
                            className="form-control"
                            placeholder="Doe"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                    </div>
                </div>

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

                <PasswordInput
                    label="Confirm Password"
                    id="passwordConfirm"
                    name="passwordConfirm"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                />

                <button
                    type="submit"
                    className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold shadow hover-lift mb-3 mt-2"
                    disabled={loading}
                >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
            </form>

            <p className="text-center text-secondary small mb-0">
                Already have an account?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} className="text-primary text-decoration-none fw-semibold">Sign in</a>
            </p>
        </AuthLayout>
    );
}
