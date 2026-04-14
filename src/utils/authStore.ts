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
    // Check local storage for mock session on load
    const savedUserStr = localStorage.getItem('mockSessionUser');
    if (savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      // Self-healing: clear session if they have any old non-DB mock IDs (<15 chars usually)
      if (['stu_123', 'admin_123', 'sup_123'].includes(savedUser.id) || savedUser.id.length < 15) {
         localStorage.removeItem('mockSessionUser');
         localStorage.removeItem('userId');
         set({ user: null, isAuthenticated: false });
      } else {
         set({ user: savedUser, isAuthenticated: true });
      }
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
