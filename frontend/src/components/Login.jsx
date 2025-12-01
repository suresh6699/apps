import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Upload, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../services/api';
import LoadingScreen from './LoadingScreen';
import { SplineScene } from './ui/splite';
import { SpotlightInteractive } from './ui/spotlight-ibelick';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState(
    localStorage.getItem('finance_app_bg') || ''
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [googlePopup, setGooglePopup] = useState(null);

  // Handle Google OAuth callback
  useEffect(() => {
    // Get query parameters from hash (HashRouter compatible)
    // URL format: /#/?token=xxx&auth=google
    const hash = window.location.hash;
    let searchParams = '';
    
    // Extract query params from hash
    if (hash.includes('?')) {
      searchParams = hash.split('?')[1];
    }
    
    const params = new URLSearchParams(searchParams);
    const token = params.get('token');
    const authType = params.get('auth');
    
    if (token && authType === 'google') {
      // Immediately show loading screen
      setIsAuthenticating(true);
      
      // Save token and redirect to dashboard
      localStorage.setItem('token', token);
      
      // Fetch user data
      fetch(API_URL ? `${API_URL}/api/auth/verify` : '/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            console.log('Login - Google user data:', data.user);
            console.log('Login - User has googleId:', data.user.googleId);
            console.log('Login - User has picture:', data.user.picture);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Dispatch event to notify AuthContext
            window.dispatchEvent(new CustomEvent('auth:refresh'));
            
            // Check if there's a return path stored
            const returnPath = sessionStorage.getItem('returnAfterAuth');
            sessionStorage.removeItem('returnAfterAuth');
            
            // Clean up URL and reload to reinitialize AuthContext
            const redirectPath = returnPath || '#/dashboard';
            window.location.href = window.location.pathname + redirectPath;
            window.location.reload();
          }
        })
        .catch(err => {
          console.error('Error verifying Google token:', err);
          setError('Google authentication failed');
          setIsAuthenticating(false);
        });
    }
    
    // Check for errors
    const errorParam = params.get('error');
    if (errorParam) {
      setError('Google authentication failed. Please try again.');
    }
  }, [location, navigate]);

  // Listen for messages from popup
  useEffect(() => {
    const handleMessage = async (event) => {
      console.log('Login - Received message:', event.data, 'from origin:', event.origin);
      
      // Only process messages with our expected types
      if (!event.data || !event.data.type) {
        return;
      }

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
        console.log('Login - Processing Google auth success');
        setIsAuthenticating(true);
        
        // Send acknowledgment to popup
        if (googlePopup && !googlePopup.closed) {
          try {
            googlePopup.postMessage({ type: 'GOOGLE_AUTH_ACK' }, '*');
            console.log('Login - Sent acknowledgment to popup');
          } catch (err) {
            console.error('Login - Error sending ack:', err);
          }
        }

        try {
          // Save token
          localStorage.setItem('token', event.data.token);
          console.log('Login - Token saved to localStorage');
          
          // Fetch user data
          const response = await fetch(API_URL ? `${API_URL}/api/auth/verify` : '/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${event.data.token}`
            }
          });
          
          const data = await response.json();
          console.log('Login - User data fetched:', data);
          
          if (data.user) {
            console.log('Login (popup) - Google user data:', data.user);
            console.log('Login (popup) - User has googleId:', data.user.googleId);
            console.log('Login (popup) - User has picture:', data.user.picture);
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log('Login - User data saved, redirecting to dashboard');
            
            // Dispatch event to notify AuthContext
            window.dispatchEvent(new CustomEvent('auth:refresh'));
            
            // Close popup before redirect
            if (googlePopup && !googlePopup.closed) {
              googlePopup.close();
            }
            
            // Redirect and reload to update AuthContext
            window.location.href = window.location.pathname + '#/dashboard';
            window.location.reload();
          } else {
            console.error('Login - No user data received');
            setError('Failed to get user data');
            setIsAuthenticating(false);
            
            // Close popup on error
            if (googlePopup && !googlePopup.closed) {
              googlePopup.close();
            }
          }
        } catch (err) {
          console.error('Error verifying Google token:', err);
          setError('Google authentication failed');
          setIsAuthenticating(false);
          
          // Close popup on error
          if (googlePopup && !googlePopup.closed) {
            googlePopup.close();
          }
        }
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        console.log('Login - Received Google auth error:', event.data.error);
        setError('Google authentication failed. Please try again.');
        setIsAuthenticating(false);
        
        // Close popup
        if (googlePopup && !googlePopup.closed) {
          googlePopup.close();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed without completing auth
    const popupCheckInterval = setInterval(() => {
      if (googlePopup && googlePopup.closed) {
        setIsAuthenticating(false);
        setGooglePopup(null);
      }
    }, 500);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(popupCheckInterval);
    };
  }, [googlePopup, navigate]);

  // Load saved credentials on component mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    const savedPassword = localStorage.getItem('saved_password');
    const savedRememberMe = localStorage.getItem('remember_me') === 'true';

    if (savedRememberMe && savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await login(username, password);
      
      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem('saved_username', username);
        localStorage.setItem('saved_password', password);
        localStorage.setItem('remember_me', 'true');
      } else {
        // Clear saved credentials if remember me is not checked
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
        localStorage.removeItem('remember_me');
      }
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = (e) => {
    setButtonClicked(true);
    
    // Create ripple effect
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const ripple = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      id: Date.now()
    };
    
    setRipples(prev => [...prev, ripple]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== ripple.id));
    }, 600);
    
    setTimeout(() => setButtonClicked(false), 200);
    handleLogin();
  };

  const handleBackgroundChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const dataUrl = event.target.result;
          localStorage.setItem('finance_app_bg', dataUrl);
          setBackgroundImage(dataUrl);
        } catch (err) {
          alert('Image too large to save');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRememberMeChange = (e) => {
    const checked = e.target.checked;
    setRememberMe(checked);
    
    // If unchecked, clear saved credentials immediately
    if (!checked) {
      localStorage.removeItem('saved_username');
      localStorage.removeItem('saved_password');
      localStorage.removeItem('remember_me');
    }
  };

  // Open Google OAuth in popup window
  const openGooglePopup = (url) => {
    // Calculate center position
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    // Open popup
    const popup = window.open(
      url,
      'Google Sign In',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
    
    if (!popup) {
      setError('Please allow popups for this site');
      return;
    }
    
    setGooglePopup(popup);
    
    // Focus popup
    popup.focus();
  };

  // Show loading screen during Google OAuth authentication
  if (isAuthenticating) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Full Screen Animated Background */}
      {backgroundImage ? (
        <div 
          className="fixed inset-0 w-full h-full z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat'
          }}
        />
      ) : (
        <div 
          className="fixed inset-0 w-full h-full z-0 bg-black"
        >
          <div 
            className="absolute inset-0 w-full h-full"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.15) 25%, rgba(236,72,153,0.15) 50%, rgba(99,102,241,0.15) 75%, rgba(6,182,212,0.15) 100%)',
              backgroundSize: '400% 400%',
              animation: 'gradientShift 15s ease infinite'
            }}
          />
        </div>
      )}

      {/* Browse & Reset Buttons - Top Left Corner */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-50 flex gap-1 md:gap-2">
        {/* Browse Button */}
        <label htmlFor="bg-upload" className="cursor-pointer">
          <div className="group bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-white/30 rounded-lg px-2 py-1 md:px-3 md:py-1.5 hover:from-gray-800/90 hover:to-gray-700/90 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105">
            <div className="flex items-center space-x-1 md:space-x-1.5">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all duration-300">
                <Upload className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
              </div>
              <span className="text-white font-medium text-[10px] md:text-xs">Browse</span>
            </div>
          </div>
          <input
            id="bg-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBackgroundChange}
          />
        </label>

        {/* Reset Button - Only show when image is uploaded */}
        {backgroundImage && (
          <button
            onClick={() => {
              localStorage.removeItem('finance_app_bg');
              setBackgroundImage('');
            }}
            className="group bg-gradient-to-br from-red-600/80 to-red-700/80 backdrop-blur-lg border border-red-400/30 rounded-lg px-2 py-1 md:px-3 md:py-1.5 hover:from-red-500/90 hover:to-red-600/90 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
          >
            <div className="flex items-center space-x-1 md:space-x-1.5">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all duration-300">
                <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-white font-medium text-[10px] md:text-xs">Reset</span>
            </div>
          </button>
        )}
      </div>

      {/* Main Content Container - Split Layout */}
      <div className="w-full h-screen flex items-center relative z-10">
        {/* Left Side - 3D Spline Scene with Full Screen Spotlight (Hidden on mobile OR when custom wallpaper is set) - FREE FLOATING NO CONSTRAINTS */}
        {!backgroundImage && (
          <div className="hidden lg:block fixed top-0 h-full overflow-visible" style={{ left: '-5%', width: '60%', zIndex: 5 }}>
            {/* Full screen spotlight container */}
            <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              <SpotlightInteractive
                className="from-white via-white/80 to-transparent"
                size={300}
              />
            </div>
            {/* Robot container - free floating with extra space */}
            <div className="absolute inset-0 flex items-center justify-center overflow-visible" style={{ left: '-10%', width: '120%' }}>
              <div className="w-full h-full overflow-visible">
                <SplineScene 
                  scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Right Side - Login Form with Delayed Animation - Fully Interactive */}
        <div className="w-full lg:w-1/2 lg:ml-auto flex items-center justify-center px-4 sm:px-6 md:px-8 py-4 relative" style={{ zIndex: 50 }}>
          <div className="w-full max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-md animate-fadeIn">
          {/* Glassmorphism Card Container */}
          <div className="relative">
            {/* Glow effect behind card - matching background colors */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-indigo-500/30 to-purple-500/30 rounded-2xl md:rounded-3xl blur-3xl transform scale-105 animate-pulse-glow" />
            
            {/* Main Card */}
            <div className="relative bg-gradient-to-br from-slate-800/85 via-slate-900/85 to-indigo-950/85 backdrop-blur-3xl rounded-2xl md:rounded-3xl p-6 sm:p-7 md:p-8 border border-white/10 shadow-2xl overflow-visible">
              {/* Animated gradient border */}
              <div className="absolute inset-0 rounded-2xl md:rounded-3xl overflow-hidden">
                <div className="absolute inset-[-2px] bg-gradient-to-r from-blue-400/40 via-indigo-400/40 to-purple-400/40 opacity-40 blur-md animate-border-glow" />
              </div>

              {/* Inner shadow for depth */}
              <div className="absolute inset-2 rounded-2xl md:rounded-3xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              
              <div className="relative z-10 overflow-visible">
                {/* Logo and Brand */}
                <div className="mb-5">
                  {/* Logo - Centered */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.6)] transform hover:scale-110 transition-transform duration-300 border-2 md:border-3 border-white/20">
                        <svg className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3v18h18" />
                          <path d="M18 17V9" />
                          <path d="M13 17V5" />
                          <path d="M8 17v-3" />
                        </svg>
                      </div>
                      {/* Animated ring around logo */}
                      <div className="absolute inset-0 rounded-full border-2 border-blue-400/50 animate-ping opacity-60"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>
                    </div>
                  </div>
                  
                  {/* Title - Centered */}
                  <div className="text-center mb-3">
                    <span className="text-2xl sm:text-3xl md:text-3xl font-bold drop-shadow-2xl tracking-tight block leading-tight mb-1">
                      <span className="bg-gradient-to-r from-blue-200 via-blue-100 to-white text-transparent bg-clip-text drop-shadow-[0_2px_10px_rgba(147,197,253,0.8)]">
                        Smart
                      </span>
                      <span className="bg-gradient-to-r from-white via-indigo-100 to-purple-200 text-transparent bg-clip-text drop-shadow-[0_2px_10px_rgba(196,181,253,0.8)]">
                        Log
                      </span>
                    </span>
                    <span className="text-[10px] sm:text-xs text-blue-200 font-semibold tracking-widest block drop-shadow-lg">FINANCE TRACKER</span>
                  </div>
                  
                  <div className="mb-5 overflow-visible">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-2 text-center">
                      <span className="text-white drop-shadow-[0_2px_20px_rgba(147,197,253,0.8)]" style={{ 
                        fontFamily: "'Poppins', sans-serif", 
                        letterSpacing: '0.05em'
                      }}>
                        Welcome
                      </span>
                    </h1>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="h-0.5 md:h-1 w-16 md:w-20 bg-gradient-to-r from-transparent via-blue-300/80 to-transparent rounded-full shadow-lg shadow-blue-400/30"></div>
                      <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse shadow-xl shadow-blue-400/80"></div>
                      <div className="h-0.5 md:h-1 w-16 md:w-20 bg-gradient-to-r from-transparent via-blue-300/80 to-transparent rounded-full shadow-lg shadow-blue-400/30"></div>
                    </div>
                  </div>
                </div>

                {/* Login Form */}
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-white px-4 py-2.5 rounded-xl text-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="relative w-full bg-white/95 backdrop-blur-sm border-2 border-white/40 text-gray-900 placeholder:text-gray-500 h-12 sm:h-13 px-4 sm:px-5 rounded-xl shadow-lg focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 hover:shadow-xl hover:border-white/60 font-medium text-sm sm:text-base"
                      placeholder="admin"
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300" />
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/95 backdrop-blur-sm border-2 border-white/40 text-gray-900 placeholder:text-gray-500 h-12 sm:h-13 px-4 sm:px-5 pr-12 rounded-xl shadow-lg focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 hover:shadow-xl hover:border-white/60 font-medium text-sm sm:text-base"
                        placeholder="••••••••••••"
                        onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-start">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={handleRememberMeChange}
                        className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded border-2 border-white/50 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 bg-white/40 cursor-pointer shadow-lg" 
                      />
                      <span className="text-white text-xs sm:text-sm group-hover:text-white/90 transition-colors font-semibold drop-shadow-lg">Remember me</span>
                    </label>
                  </div>

                  {/* Enhanced Button with Next-Level Click Effects */}
                  <div className="relative group">
                    {/* Outer glow - pulsing */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl opacity-60 group-hover:opacity-80 blur-xl transition-all duration-300 shadow-2xl group-hover:blur-2xl animate-pulse-slow" />
                    
                    {/* Button container with perspective */}
                    <div className="relative" style={{ perspective: '1000px' }}>
                      <Button
                        onClick={handleButtonClick}
                        disabled={loading}
                        className={`
                          relative w-full h-13 sm:h-14 rounded-xl overflow-hidden
                          bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700
                          hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700
                          text-white font-bold text-base sm:text-lg tracking-wide
                          border-2 border-white/20
                          shadow-[0_4px_20px_rgba(59,130,246,0.5)] hover:shadow-[0_6px_30px_rgba(99,102,241,0.7)]
                          transition-all duration-300
                          disabled:opacity-50 disabled:cursor-not-allowed
                          ${buttonClicked ? 'scale-95' : 'hover:scale-[1.02]'}
                          ${loading ? 'animate-pulse' : ''}
                        `}
                        style={{
                          transform: buttonClicked ? 'scale(0.95) rotateX(5deg)' : '',
                          transformStyle: 'preserve-3d',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        {/* Shimmer effect overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                        
                        {/* Ripple effects */}
                        {ripples.map(ripple => (
                          <span
                            key={ripple.id}
                            className="absolute rounded-full bg-white/50 animate-ripple"
                            style={{
                              left: ripple.x,
                              top: ripple.y,
                              width: '20px',
                              height: '20px',
                              transform: 'translate(-50%, -50%)',
                              pointerEvents: 'none'
                            }}
                          />
                        ))}
                        
                        {/* Button text with icon */}
                        <span className="relative z-10 flex items-center justify-center space-x-2">
                          {loading ? (
                            <>
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-base font-bold">Signing In...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold drop-shadow-lg">Sign In</span>
                              <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </>
                          )}
                        </span>
                        
                        {/* Bottom shine effect */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                      </Button>
                    </div>
                    
                    {/* Success particles effect placeholder */}
                    {buttonClicked && !loading && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-cyan-300 rounded-full animate-particle-1" />
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-300 rounded-full animate-particle-2" />
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-sky-300 rounded-full animate-particle-3" />
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-indigo-300 rounded-full animate-particle-4" />
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/30"></div>
                    </div>
                  </div>

                  {/* Google Sign-In Button */}
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-white/15 rounded-xl opacity-50 group-hover:opacity-70 blur-lg transition-all duration-300" />
                    <button
                      onClick={() => {
                        const googleAuthUrl = API_URL 
                          ? `${API_URL}/api/auth/google`
                          : '/api/auth/google';
                        
                        // Check if we're in Electron
                        const isElectron = window.electron?.isElectron || false;
                        
                        if (isElectron) {
                          // In Electron, use IPC to open OAuth in new window
                          if (window.electron?.openGoogleAuth) {
                            window.electron.openGoogleAuth(googleAuthUrl);
                          } else {
                            // Fallback to popup
                            openGooglePopup(googleAuthUrl);
                          }
                        } else {
                          // In browser, open popup
                          openGooglePopup(googleAuthUrl);
                        }
                      }}
                      disabled={loading || isAuthenticating}
                      className="relative w-full h-13 sm:h-14 rounded-xl overflow-hidden bg-white/95 hover:bg-white text-gray-800 font-bold text-base sm:text-lg tracking-wide border-2 border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2.5"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-base sm:text-lg font-bold">
                        {isAuthenticating ? 'Authenticating...' : 'Continue with Google'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes spotlight {
          0% { opacity: 0; transform: translate(-72%, -62%) scale(0.5); }
          100% { opacity: 1; transform: translate(-50%,-40%) scale(1); }
        }

        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .animate-spotlight {
          animation: spotlight 2s ease 0.75s 1 forwards;
        }

        .animate-fadeIn {
          opacity: 0;
          animation: fadeIn 0.8s ease 2s forwards;
        }

        .loader {
          width: 48px;
          height: 48px;
          border: 5px solid #FFF;
          border-bottom-color: transparent;
          border-radius: 50%;
          display: inline-block;
          box-sizing: border-box;
          animation: rotation 1s linear infinite;
        }

        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-15px) translateX(5px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-15px) translateX(-10px); }
          50% { transform: translateY(-25px) translateX(10px); }
          75% { transform: translateY(-10px) translateX(-5px); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
        }
        
        @keyframes float-up {
          0% { transform: translateY(0px); opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
        
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1.05); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        
        @keyframes border-glow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes ripple {
          0% {
            width: 20px;
            height: 20px;
            opacity: 1;
          }
          100% {
            width: 300px;
            height: 300px;
            opacity: 0;
          }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }

        @keyframes particle-1 {
          0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(-40px, -60px); opacity: 0; }
        }

        @keyframes particle-2 {
          0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(40px, -60px); opacity: 0; }
        }

        @keyframes particle-3 {
          0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(-60px, 40px); opacity: 0; }
        }

        @keyframes particle-4 {
          0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(60px, 40px); opacity: 0; }
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 25s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 30s ease-in-out infinite;
        }
        
        .animate-float-up {
          animation: float-up 15s linear infinite;
        }
        
        .animate-float-up-delayed {
          animation: float-up 18s linear infinite;
          animation-delay: 3s;
        }
        
        .animate-float-up-slow {
          animation: float-up 20s linear infinite;
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }
        
        .animate-border-glow {
          animation: border-glow 8s linear infinite;
        }

        .animate-ripple {
          animation: ripple 0.6s ease-out forwards;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .animate-particle-1 {
          animation: particle-1 0.6s ease-out forwards;
        }

        .animate-particle-2 {
          animation: particle-2 0.6s ease-out forwards;
        }

        .animate-particle-3 {
          animation: particle-3 0.6s ease-out forwards;
        }

        .animate-particle-4 {
          animation: particle-4 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Login;
