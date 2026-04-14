import axios from 'axios';
import { useToastStore } from '../utils/toastStore';

const API_BASE_URL = import.meta.env.PROD 
  ? 'https://college-project-backend-r7f9.onrender.com/api' 
  : 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor for Request (Mocking Auth logic for future JWT integration)
api.interceptors.request.use(
  (config) => {
    // Attempt to grab generic ID from localStorage simulating a session token
    // In future, replace with 'Authorization: Bearer <token>'
    const userId = localStorage.getItem('userId');
    if (userId) {
      config.headers['X-User-ID'] = userId; 
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for Response Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Error Handling centralized to trigger UI toasts directly
    const msg = error.response?.data?.message || error.message || 'An unexpected error occurred';
    
    // Using Zustand store directly outside React tree
    useToastStore.getState().addToast(msg, 'error');
    
    return Promise.reject(error);
  }
);
