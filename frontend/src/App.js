import React, { createContext, useState, useEffect, useContext, Suspense, lazy } from 'react';
import './App.css';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoadingScreen from './components/LoadingScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy load components for better performance and loading states
const Login = lazy(() => import('./components/Login'));
const GoogleCallback = lazy(() => import('./components/GoogleCallback'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Account = lazy(() => import('./components/Account'));
const EntryDetails = lazy(() => import('./components/EntryDetails'));
const CustomerChat = lazy(() => import('./components/CustomerChat'));
const Collections = lazy(() => import('./components/Collections'));

// Theme Context
export const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return isAuthenticated ? children : <Navigate to="/" replace />;
};

function App() {
  const [theme, setTheme] = useState(() => {
    // Get theme from localStorage or default to 'light'
    return localStorage.getItem('app-theme') || 'light';
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <AuthProvider>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <div className="App">
          <HashRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/callback" element={<GoogleCallback />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/entry"
                  element={
                    <ProtectedRoute>
                      <EntryDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute>
                      <CustomerChat />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/collections"
                  element={
                    <ProtectedRoute>
                      <Collections />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <Account />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </HashRouter>
        </div>
      </ThemeContext.Provider>
    </AuthProvider>
  );
}

export default App;