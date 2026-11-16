import { create } from 'zustand';
import { api } from '../services/api';
import { queryClient } from './queryClient';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  
  initialize: () => {
    // Restore session from localStorage for page refreshes.
    const savedUserStr = localStorage.getItem('mockSessionUser');
    if (!savedUserStr) {
      set({ user: null, isAuthenticated: false, isInitialized: true });
      return;
    }

    try {
      const savedUser = JSON.parse(savedUserStr) as User;
      if (savedUser?.id && savedUser?.role) {
        set({ user: savedUser, isAuthenticated: true, isInitialized: true });
      } else {
        localStorage.removeItem('mockSessionUser');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        set({ user: null, isAuthenticated: false, isInitialized: true });
      }
    } catch {
      localStorage.removeItem('mockSessionUser');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      set({ user: null, isAuthenticated: false, isInitialized: true });
    }
  },

  login: (userData: User) => {
    queryClient.clear();
    localStorage.setItem('mockSessionUser', JSON.stringify(userData));
    localStorage.setItem('userId', userData.id); // for API interceptor
    localStorage.setItem('userRole', userData.role);
    set({ user: userData, isAuthenticated: true, isInitialized: true });
  },

  logout: async () => {
    // Do not report a successful logout if the server session could not be revoked.
    await api.post('/session/logout');
    queryClient.clear();
    localStorage.removeItem('mockSessionUser');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    set({ user: null, isAuthenticated: false, isInitialized: true });
  },
}));
