import React, { useState, useEffect } from 'react';
import { API } from './api';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyOTP from './pages/VerifyOTP';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import AppLayout from './components/AppLayout';

export default function App() {
    const [page, setPage] = useState('landing');
    const [navData, setNavData] = useState(null); // Used to pass data between screens (like user_id to verify_otp)
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    const checkAuthStatus = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const res = await API.get('/api/auth/user/');
                setUser(res.data);
                setPage('dashboard');
            } catch (err) {
                // Invalid or expired token: clear storage
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                setUser(null);
                setPage('landing');
            }
        } else {
            setPage('landing');
        }
        setAuthChecked(true);
    };

    useEffect(() => {
        checkAuthStatus();

        // Listen for global logout events triggered by expired refresh tokens
        const handleGlobalLogout = () => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setUser(null);
            setPage('landing');
        };

        window.addEventListener('auth_logout', handleGlobalLogout);
        return () => window.removeEventListener('auth_logout', handleGlobalLogout);
    }, []);

    useEffect(() => {
        const titles = {
            landing: 'Tyqro | Simplify Your Day',
            login: 'Sign In | Tyqro',
            signup: 'Sign Up | Tyqro',
            verify_otp: 'Verify Account | Tyqro',
            forgot_password: 'Reset Password | Tyqro',
            dashboard: 'Dashboard | Tyqro'
        };
        document.title = titles[page] || 'Tyqro | Simplify Your Day';

        // Set correct theme prefix depending on active page context
        if (page === 'landing') {
            document.documentElement.setAttribute('data-bs-theme', 'light');
        } else if (['login', 'signup', 'verify_otp', 'forgot_password'].includes(page)) {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
        } else if (page === 'dashboard') {
            const storedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-bs-theme', storedTheme);
        }
    }, [page]);

    const handleLoginSuccess = () => {
        checkAuthStatus();
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setPage('landing');
    };

    const handleUpdateUser = () => {
        checkAuthStatus();
    };

    const handleNavigate = (targetPage, data = null) => {
        setNavData(data);
        setPage(targetPage);
    };

    if (!authChecked) {
        return (
            <div className="d-flex align-items-center justify-content-center min-vh-100 bg-dark text-white">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    // Render corresponding screen
    switch (page) {
        case 'landing':
            return <Landing onNavigate={handleNavigate} />;
        case 'login':
            return <Login onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />;
        case 'signup':
            return <Signup onNavigate={handleNavigate} />;
        case 'verify_otp':
            return <VerifyOTP onNavigate={handleNavigate} navData={navData} />;
        case 'forgot_password':
            return <ForgotPassword onNavigate={handleNavigate} />;
        case 'dashboard':
            return (
                <AppLayout user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser}>
                    <Dashboard user={user} />
                </AppLayout>
            );
        default:
            return <Landing onNavigate={handleNavigate} />;
    }
}
