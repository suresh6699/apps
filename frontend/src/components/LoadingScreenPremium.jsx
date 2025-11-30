import React from 'react';
import { useTheme } from '../App';

const LoadingScreenPremium = () => {
  const { theme } = useTheme();

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden ${
      theme === 'light' 
        ? 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100' 
        : 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900'
    }`}>
      {/* Animated Grid Background */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 ${
          theme === 'light' 
            ? 'bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)]' 
            : 'bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]'
        } bg-[size:4rem_4rem]`}></div>
      </div>

      {/* Glowing Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/3 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-30 animate-pulse ${
          theme === 'light' ? 'bg-blue-500' : 'bg-blue-600'
        }`} style={{ animationDuration: '4s' }}></div>
        <div className={`absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${
          theme === 'light' ? 'bg-purple-500' : 'bg-purple-600'
        }`} style={{ animationDuration: '5s', animationDelay: '1s' }}></div>
        <div className={`absolute top-1/2 left-1/2 w-64 h-64 rounded-full blur-3xl opacity-25 animate-pulse ${
          theme === 'light' ? 'bg-indigo-500' : 'bg-indigo-600'
        }`} style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-12">
        {/* Premium 3D Loader */}
        <div className="relative" style={{ perspective: '1000px' }}>
          {/* Outer Rotating Cube Frame */}
          <div 
            className="relative animate-spin-slow"
            style={{ 
              width: '160px', 
              height: '160px',
              transformStyle: 'preserve-3d',
              animation: 'spin-3d 8s linear infinite'
            }}
          >
            {/* Multiple Rotating Rings */}
            {[0, 60, 120].map((rotation, index) => (
              <div
                key={index}
                className={`absolute inset-0 rounded-full border-4 ${
                  theme === 'light' 
                    ? 'border-blue-500/30' 
                    : 'border-blue-400/30'
                }`}
                style={{
                  transform: `rotateX(${rotation}deg) rotateY(${rotation}deg)`,
                  animation: `orbit-${index} ${4 + index}s linear infinite`,
                  animationDelay: `${index * 0.5}s`
                }}
              ></div>
            ))}
            
            {/* Center Glowing Sphere */}
            <div className={`absolute inset-0 flex items-center justify-center`}>
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl ${
                theme === 'light' 
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                  : 'bg-gradient-to-br from-blue-600 to-purple-700'
              }`} style={{
                boxShadow: theme === 'light' 
                  ? '0 0 60px rgba(59, 130, 246, 0.6), 0 0 100px rgba(147, 51, 234, 0.4)' 
                  : '0 0 60px rgba(96, 165, 250, 0.8), 0 0 100px rgba(167, 139, 250, 0.6)',
                animation: 'pulse-glow 2s ease-in-out infinite'
              }}>
                {/* Inner Pulse */}
                <div className={`absolute inset-2 rounded-full animate-ping ${
                  theme === 'light' ? 'bg-white/40' : 'bg-white/30'
                }`} style={{ animationDuration: '2s' }}></div>
                
                {/* Icon */}
                <svg 
                  className="w-12 h-12 text-white relative z-10" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2.5} 
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center space-y-6">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className={`text-4xl font-bold tracking-tight ${
              theme === 'light' 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600' 
                : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400'
            }`}>
              Loading
            </h1>
            <p className={`text-base ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Preparing your financial dashboard
            </p>
          </div>

          {/* Animated Progress Indicator */}
          <div className="flex items-center space-x-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  theme === 'light' ? 'bg-blue-500' : 'bg-blue-400'
                }`}
                style={{
                  animation: 'bounce 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.16}s`
                }}
              ></div>
            ))}
          </div>

          {/* Premium Progress Bar */}
          <div className="w-80 space-y-2">
            <div className={`h-1.5 rounded-full overflow-hidden ${
              theme === 'light' 
                ? 'bg-slate-200' 
                : 'bg-slate-800'
            }`}>
              <div 
                className={`h-full rounded-full relative overflow-hidden ${
                  theme === 'light' 
                    ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500' 
                    : 'bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400'
                }`}
                style={{
                  animation: 'loading-bar-premium 2s ease-in-out infinite'
                }}
              >
                {/* Shimmer Effect */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  style={{
                    animation: 'shimmer 1.5s ease-in-out infinite'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`absolute ${
                theme === 'light' 
                  ? 'bg-gradient-to-br from-blue-400 to-purple-400' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-500'
              }`}
              style={{
                width: `${8 + i * 2}px`,
                height: `${8 + i * 2}px`,
                borderRadius: '50%',
                left: `${10 + i * 12}%`,
                top: `${20 + (i % 4) * 20}%`,
                animation: `float-random ${3 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
                opacity: 0.3,
                filter: 'blur(1px)'
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes spin-3d {
          0% {
            transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          100% {
            transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg);
          }
        }

        @keyframes orbit-0 {
          0% {
            transform: rotateX(0deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(360deg) rotateY(360deg);
          }
        }

        @keyframes orbit-1 {
          0% {
            transform: rotateX(60deg) rotateY(60deg);
          }
          100% {
            transform: rotateX(420deg) rotateY(420deg);
          }
        }

        @keyframes orbit-2 {
          0% {
            transform: rotateX(120deg) rotateY(120deg);
          }
          100% {
            transform: rotateX(480deg) rotateY(480deg);
          }
        }

        @keyframes loading-bar-premium {
          0% {
            width: 0%;
            transform: translateX(0);
          }
          50% {
            width: 100%;
            transform: translateX(0);
          }
          100% {
            width: 100%;
            transform: translateX(100%);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }

        @keyframes float-random {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          25% {
            transform: translate(-15px, -20px) scale(1.1);
            opacity: 0.6;
          }
          50% {
            transform: translate(10px, -15px) scale(0.9);
            opacity: 0.5;
          }
          75% {
            transform: translate(20px, 10px) scale(1.05);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreenPremium;
