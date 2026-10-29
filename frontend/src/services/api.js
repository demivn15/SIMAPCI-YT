import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:8000/api/v1', // FastAPI backend URL
    withCredentials: true, // CRITICAL: Sends and receives cookies cross-origin
    headers: {
        'Content-Type': 'application/json',
    },
});

// Global Response Interceptor
api.interceptors.response.use(
    (response) => response, // Pass through successful responses
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid session - force redirect to login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login?expired=true';
            }
        }
        return Promise.reject(error);
    }
);
