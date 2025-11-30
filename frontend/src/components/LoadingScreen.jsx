import React from 'react';
import { useTheme } from '../App';
import { IndianRupee, DollarSign, TrendingUp, Coins } from 'lucide-react';

const LoadingScreen = () => {
  const { theme } = useTheme();

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-300 ${
      theme === 'light' 
        ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50' 
        : 'bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900'
    }`}>
      {/* Animated Background Circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${
          theme === 'light' ? 'bg-emerald-400' : 'bg-emerald-600'
        }`} style={{ animationDuration: '3s' }}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${
          theme === 'light' ? 'bg-green-400' : 'bg-green-600'
        }`} style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
      </div>

      {/* Main Loading Container */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
        {/* Circular Money Loading Animation */}
        <div className="relative" style={{ width: '160px', height: '160px' }}>
          {/* Outer rotating circle with gradient */}
          <div className={`absolute inset-0 rounded-full animate-spin ${
            theme === 'light' 
              ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500' 
              : 'bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400'
          }`} style={{ 
            animationDuration: '2s',
            padding: '4px',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 8px), white calc(100% - 7px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 8px), white calc(100% - 7px))'
          }}></div>
          
          {/* Middle rotating circle - counter direction */}
          <div className={`absolute inset-4 rounded-full animate-spin ${
            theme === 'light' 
              ? 'bg-gradient-to-l from-green-500 via-emerald-500 to-teal-500' 
              : 'bg-gradient-to-l from-green-400 via-emerald-400 to-teal-400'
          }`} style={{ 
            animationDuration: '1.5s',
            animationDirection: 'reverse',
            padding: '3px',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), white calc(100% - 5px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), white calc(100% - 5px))'
          }}></div>

          {/* Center circle with money icon */}
          <div className={`absolute inset-8 rounded-full shadow-2xl flex items-center justify-center ${
            theme === 'light' 
              ? 'bg-white' 
              : 'bg-slate-800'
          }`}>
            {/* Animated Rupee Symbol */}
            <div className="relative">
              <IndianRupee 
                className={`w-16 h-16 animate-pulse ${
                  theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                }`}
                strokeWidth={2.5}
                style={{ animationDuration: '1.5s' }}
              />
              {/* Small coin icon rotating around */}
              <div className="absolute -top-2 -right-2 animate-spin" style={{ animationDuration: '3s' }}>
                <Coins 
                  className={`w-6 h-6 ${
                    theme === 'light' ? 'text-amber-500' : 'text-amber-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="flex flex-col items-center space-y-3">
          <h2 className={`text-2xl font-bold flex items-center gap-2 ${
            theme === 'light' 
              ? 'text-slate-800' 
              : 'text-white'
          }`}>
            <TrendingUp className={`w-6 h-6 animate-bounce ${
              theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
            }`} style={{ animationDuration: '1s' }} />
            Processing
            <span className="inline-flex ml-1">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
            </span>
          </h2>
          
          {/* Circular Progress Indicator */}
          <div className="relative w-64 h-1.5 rounded-full overflow-hidden">
            <div className={`absolute inset-0 ${
              theme === 'light' ? 'bg-emerald-100' : 'bg-slate-700'
            }`}></div>
            <div 
              className={`absolute inset-0 rounded-full origin-left animate-progress ${
                theme === 'light' 
                  ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600' 
                  : 'bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500'
              }`}
            ></div>
          </div>
          
          <p className={`text-sm flex items-center gap-2 ${
            theme === 'light' 
              ? 'text-slate-600' 
              : 'text-slate-400'
          }`}>
            <span>Loading your financial data</span>
          </p>
        </div>

        {/* Floating Money Icons */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => {
            const icons = [IndianRupee, DollarSign, Coins, TrendingUp];
            const Icon = icons[i % icons.length];
            return (
              <div
                key={i}
                className="absolute animate-float-money"
                style={{
                  left: `${15 + i * 12}%`,
                  top: `${25 + (i % 4) * 15}%`,
                  animationDelay: `${i * 0.6}s`,
                  animationDuration: `${4 + i * 0.3}s`,
                  opacity: 0.15
                }}
              >
                <Icon 
                  className={`w-6 h-6 ${
                    theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            transform: scaleX(0);
          }
          50% {
            transform: scaleX(0.7);
          }
          100% {
            transform: scaleX(1);
          }
        }
        
        @keyframes float-money {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.15;
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
            opacity: 0.25;
          }
        }
        
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
        
        .animate-float-money {
          animation: float-money 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
