import axios from 'axios';

export const api = axios.create({
    // FastAPI backend URL. En el despliegue se define VITE_API_URL; en local se usa el valor por defecto
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
    withCredentials: true, // CRITICAL: Sends and receives cookies cross-origin
    headers: {
        'Content-Type': 'application/json',
    },
});

// Global Response Interceptor
api.interceptors.response.use(
    (response) => response, // Pass through successful responses
    (error) => {
        // /auth/me y /auth/login responden 401 de forma normal (aún no hay sesión
        // o las credenciales son incorrectas): no significan que una sesión venció.
        // De esos casos se encargan ProtectedRoute y la pantalla de login.
        const isAuthRequest = ['/auth/me', '/auth/login'].includes(error.config?.url);

        if (error.response && error.response.status === 401 && !isAuthRequest) {
            // Token expired or invalid session - force redirect to login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login?expired=true';
            }
        }
        return Promise.reject(error);
    }
);
