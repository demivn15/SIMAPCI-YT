# PGPCECMC-18-LDAP-login 

## Development Notes - Demian Viteri

### FastAPI CORS

> **Note:** If you load BACKEND_CORS_ORIGINS from a .env file as a string.

Pydantic-settings can parse JSON arrays like BACKEND_CORS_ORIGINS=\["http://localhost:5173"\] automatically.

> **Note:** Front-end integration.

If using **axios**:

```javascript
import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:8000/api/v1',
    withCredentials: true // <--- CRITICAL: Tells the browser to include cookies in cross-origin requests
});
```
If using **fetch**:

```javascript
fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include' // <--- CRITICAL: Tells fetch to store/send cookies
});
```

> **Note:** How the front-end uses /me endpoint.

```javascript
// hooks/useAuth.js (example using TanStack Query & axios)
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api'; // configured with withCredentials: true

const fetchUserProfile = async () => {
    const { data } = await api.get('/auth/me');
    return data;
};

export function useAuth() {
    const { data: user, isLoading, error, refetch } = useQuery({
        queryKey: ['authUser'],
        queryFn: fetchUserProfile,
        retry: false, // Don't retry if 401 Unauthorized
        staleTime: 1000 * 60 * 5, // Cache user profile for 5 minutes
    });

    return {
        user,
        isAuthenticated: !!user,
        isLoading,
        refetchUser: refetch,
    };
}
```
