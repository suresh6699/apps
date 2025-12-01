import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';
import syncService from '../services/syncService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to refresh user data from backend
  const refreshUserData = async () => {
    const token = authService.getToken();
    if (token) {
      try {
        const verifyData = await authService.verifyToken();
        const currentUser = verifyData.user;
        
        console.log('AuthContext - User data refreshed:', currentUser);
        console.log('AuthContext - googleId:', currentUser?.googleId);
        console.log('AuthContext - picture:', currentUser?.picture);
        
        // Update localStorage with latest user data from backend
        if (currentUser) {
          localStorage.setItem('user', JSON.stringify(currentUser));
          console.log('AuthContext - User has googleId:', !!currentUser.googleId);
        }
        
        setUser(currentUser);
        setIsAuthenticated(true);
        
        // Start auto-sync if user is authenticated with Google
        if (currentUser && currentUser.googleId) {
          console.log('AuthContext - Starting auto-sync for Google user');
          syncService.startAutoSync();
        }
        
        return currentUser;
      } catch (error) {
        console.error('AuthContext - Token verification failed:', error);
        throw error;
      }
    }
    return null;
  };

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = authService.getToken();
      if (token) {
        try {
          await refreshUserData();
        } catch (error) {
          console.error('AuthContext - Initial auth check failed:', error);
          authService.logout();
          setUser(null);
          setIsAuthenticated(false);
          syncService.stopAutoSync();
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for custom events to refresh user data
    const handleAuthRefresh = async () => {
      console.log('AuthContext - Received auth refresh event');
      try {
        await refreshUserData();
      } catch (error) {
        console.error('AuthContext - Refresh failed:', error);
      }
    };

    window.addEventListener('auth:refresh', handleAuthRefresh);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('auth:refresh', handleAuthRefresh);
      syncService.stopAutoSync();
    };
  }, [refreshTrigger]);

  const login = async (username, password) => {
    try {
      const data = await authService.login(username, password);
      setUser(data.user);
      setIsAuthenticated(true);
      
      // Start auto-sync if user is authenticated with Google
      if (data.user && data.user.googleId) {
        syncService.startAutoSync();
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    
    // Stop auto-sync on logout
    syncService.stopAutoSync();
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    refreshUserData, // Expose refresh function
    setUser, // Expose setUser for manual updates
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
