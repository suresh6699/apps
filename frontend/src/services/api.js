import axios from 'axios';

// Detect if running in Electron
const isElectron = window.electron?.isElectron || false;

// Set API URL based on environment
const API_URL = isElectron 
  ? 'http://localhost:8001' // Electron always uses local backend
  : (process.env.REACT_APP_API_URL || '');

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Use hash-based navigation for Electron compatibility
        window.location.hash = '#/';
      }
      
      // Return error message
      const message = error.response.data?.message || error.response.data?.error || 'An error occurred';
      return Promise.reject(new Error(message));
    }
    
    if (error.request) {
      return Promise.reject(new Error('No response from server. Please check if the backend is running.'));
    }
    
    return Promise.reject(error);
  }
);

export default api;
export { API_URL };
