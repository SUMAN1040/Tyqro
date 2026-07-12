import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const API = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Automatically inject JWT token
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Automatically refresh expired JWT access token
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
                        refresh: refreshToken,
                    });
                    const newAccessToken = response.data.access;
                    localStorage.setItem('access_token', newAccessToken);
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return API(originalRequest);
                } catch (refreshError) {
                    // Refresh token is expired too: clear storage and redirect
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.dispatchEvent(new Event('auth_logout'));
                }
            }
        }
        return Promise.reject(error);
    }
);
