import { createContext, useContext, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const AuthContext = createContext(null);

// API Functions
const fetchUserProfile = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

// T-HU02-03 (PGPCECMC-27): renovar cada 30 min mientras hay sesión. El token dura
// ACCESS_TOKEN_EXPIRE_MINUTES (8 h), así que no vence mientras la pestaña está abierta.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const refreshApi = async () => {
  await api.post('/auth/refresh');
};

const logoutApi = async () => {
  await api.post('/auth/logout');
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  // 1. Fetch current user on app load / refresh
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['authUser'],
    queryFn: fetchUserProfile,
    retry: false,                   // Don't retry if 401 Unauthorized
    staleTime: 1000 * 60 * 15,      // Keep user cached for 15 minutes
  });

  // 2. Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutApi,
    // Clear local session state even if the request fails (e.g. server unreachable),
    // so the user is never left looking logged in on this device.
    onSettled: () => {
      queryClient.setQueryData(['authUser'], null);
    },
  });

  // Si la renovación falla (sesión revocada o cuenta desactivada), se vuelve a pedir
  // el perfil: /auth/me responde 401 y ProtectedRoute lleva al login.
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => {
      refreshApi().catch(() => queryClient.invalidateQueries({ queryKey: ['authUser'] }));
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, queryClient]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isError,
    logout: logoutMutation.mutate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// El hook vive junto al proveedor a propósito; no afecta el funcionamiento
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
