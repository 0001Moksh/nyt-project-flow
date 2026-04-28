import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  
  initialize: () => {
    // Restore session from localStorage for page refreshes.
    const savedUserStr = localStorage.getItem('mockSessionUser');
    if (!savedUserStr) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    try {
      const savedUser = JSON.parse(savedUserStr) as User;
      if (savedUser?.id && savedUser?.role) {
        set({ user: savedUser, isAuthenticated: true });
      } else {
        localStorage.removeItem('mockSessionUser');
        localStorage.removeItem('userId');
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      localStorage.removeItem('mockSessionUser');
      localStorage.removeItem('userId');
      set({ user: null, isAuthenticated: false });
    }
  },

  login: (userData: User) => {
    localStorage.setItem('mockSessionUser', JSON.stringify(userData));
    localStorage.setItem('userId', userData.id); // for API interceptor
    set({ user: userData, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('mockSessionUser');
    localStorage.removeItem('userId');
    set({ user: null, isAuthenticated: false });
  },
}));
