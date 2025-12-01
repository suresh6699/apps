import api from './api';

const authService = {
  // Login
  login: async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Clear saved credentials on logout (optional - only if user explicitly logs out)
      // If you want to keep credentials saved for "Remember Me", comment out these lines:
      localStorage.removeItem('saved_username');
      localStorage.removeItem('saved_password');
      localStorage.removeItem('remember_me');
    }
  },

  // Verify token
  verifyToken: async () => {
    const response = await api.get('/api/auth/verify');
    return response.data;
  },

  // Get current user from localStorage
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Get token
  getToken: () => {
    return localStorage.getItem('token');
  },
};

export default authService;
