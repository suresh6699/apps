import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';
import { API_URL } from '../services/api';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    // Get query parameters from hash (HashRouter compatible)
    const hash = window.location.hash;
    let searchParams = '';
    
    // Extract query params from hash
    if (hash.includes('?')) {
      searchParams = hash.split('?')[1];
    }
    
    const params = new URLSearchParams(searchParams);
    const token = params.get('token');
    const authType = params.get('auth');
    const error = params.get('error');

    console.log('GoogleCallback - token:', token, 'authType:', authType, 'error:', error);

    // Check if we're in a popup
    const isPopup = window.opener && !window.opener.closed;
    console.log('GoogleCallback - isPopup:', isPopup);

    if (isPopup) {
      // We're in a popup, send message to parent
      if (token && authType === 'google') {
        console.log('GoogleCallback - Sending success message to parent');
        setMessage('Authentication successful! Closing window...');
        
        // Send message multiple times to ensure it's received
        const sendMessage = () => {
          try {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              token: token
            }, '*'); // Using wildcard for same-origin communication
            console.log('GoogleCallback - Message sent');
          } catch (err) {
            console.error('GoogleCallback - Error sending message:', err);
          }
        };
        
        // Send immediately
        sendMessage();
        
        // Send again after a short delay
        setTimeout(sendMessage, 100);
        setTimeout(sendMessage, 300);
        setTimeout(sendMessage, 500);
        
        // Listen for acknowledgment from parent
        const handleAck = (event) => {
          if (event.data && event.data.type === 'GOOGLE_AUTH_ACK') {
            console.log('GoogleCallback - Received acknowledgment, closing now');
            window.close();
          }
        };
        
        window.addEventListener('message', handleAck);
        
        // Close popup after 3 seconds even if no ack received
        setTimeout(() => {
          console.log('GoogleCallback - Closing popup (timeout)');
          window.removeEventListener('message', handleAck);
          window.close();
        }, 3000);
      } else if (error) {
        console.log('GoogleCallback - Sending error message to parent');
        setMessage('Authentication failed. Closing window...');
        
        // Error - notify parent
        try {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: error
          }, '*');
        } catch (err) {
          console.error('GoogleCallback - Error sending error message:', err);
        }
        
        // Close popup after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } else {
      console.log('GoogleCallback - Not in popup, handling directly');
      setMessage('Completing authentication...');
      
      // Not in popup, handle authentication directly
      if (token && authType === 'google') {
        // Store token first
        localStorage.setItem('token', token);
        
        // Fetch user data and store it
        fetch(API_URL ? `${API_URL}/api/auth/verify` : '/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => {
            if (!res.ok) {
              throw new Error('Failed to verify token');
            }
            return res.json();
          })
          .then(data => {
            console.log('GoogleCallback - User data received:', data);
            console.log('GoogleCallback - User googleId:', data.user?.googleId);
            console.log('GoogleCallback - User picture:', data.user?.picture);
            
            if (data.user) {
              // Store user data with all fields including googleId and picture
              localStorage.setItem('user', JSON.stringify(data.user));
              console.log('GoogleCallback - User stored in localStorage with googleId:', data.user.googleId);
              console.log('GoogleCallback - User has Google connection:', !!data.user.googleId);
              
              // Dispatch custom event to notify AuthContext to refresh
              window.dispatchEvent(new CustomEvent('auth:refresh'));
              
              // Small delay to ensure localStorage is written and event is processed
              setTimeout(() => {
                console.log('GoogleCallback - Navigating to dashboard');
                // Use hash navigation for HashRouter
                window.location.hash = '#/dashboard';
                // Force reload to ensure AuthContext picks up the new user data
                window.location.reload();
              }, 200);
            } else {
              console.error('GoogleCallback - No user data in response');
              window.location.href = window.location.pathname + '#/?error=auth_failed';
            }
          })
          .catch(err => {
            console.error('GoogleCallback - Error verifying Google token:', err);
            window.location.href = window.location.pathname + '#/?error=auth_failed';
          });
      } else if (error) {
        // Redirect to login with error
        window.location.href = window.location.pathname + '#/?error=' + error;
      }
    }
  }, [navigate]);

  return (
    <div>
      <LoadingScreen />
      <div style={{ position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'white', fontSize: '14px' }}>
        {message}
      </div>
    </div>
  );
};

export default GoogleCallback;
