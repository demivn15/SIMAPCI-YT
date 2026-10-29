import React, { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const AuthContext = createContext(null);

// API Functions
const fetchUserProfile = async () => {
  const { data } = await api.get('/auth/me');
  return data;
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
    onSuccess: () => {
      // Clear user data from cache
      queryClient.setQueryData(['authUser'], null);
    },
  });

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isError,
    logout: logoutMutation.mutate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
