import React from 'react';

interface LoadingSpinnerProps {
  customLoaderUrl?: string;
  customLoaderType?: 'default' | 'image' | 'video' | 'gif';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  customLoaderUrl,
  customLoaderType = 'default'
}) => {
  const isCustomActive = customLoaderType !== 'default' && customLoaderUrl;

  if (isCustomActive) {
    if (customLoaderType === 'video') {
      return (
        <div className="custom-loader-wrapper">
          <video 
            src={customLoaderUrl} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="custom-loader-video"
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain',
              borderRadius: '50%'
            }}
          />
        </div>
      );
    } else {
      return (
        <div className="custom-loader-wrapper">
          <img 
            src={customLoaderUrl} 
            alt="Loading..." 
            className="custom-loader-img"
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain'
            }}
          />
        </div>
      );
    }
  }

  return (
    <>
      <style>{`
        .fire-circle-spinner {
          display: block;
          filter: drop-shadow(0 0 15px rgba(255, 69, 0, 0.85));
        }
        .fire-ring-outer {
          animation: spinFireClockwise 3s linear infinite;
        }
        .fire-ring-middle {
          animation: spinFireCounterClockwise 2s linear infinite;
        }
        .fire-ring-inner {
          animation: spinFireClockwise 1.3s linear infinite;
        }
        @keyframes spinFireClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinFireCounterClockwise {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
      <svg className="fire-circle-spinner" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="fire-outer-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff1a00" />
            <stop offset="45%" stopColor="#ff5e00" />
            <stop offset="100%" stopColor="#ff9a00" />
          </linearGradient>
          <linearGradient id="fire-inner-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5e00" />
            <stop offset="60%" stopColor="#ffcc00" />
            <stop offset="100%" stopColor="#ffffcc" />
          </linearGradient>
          
          <filter id="fire-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feComponentTransfer in="blur" result="boost">
              <feFuncA type="linear" slope="1.4" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="boost" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer glowing flame ring */}
        <g className="fire-ring-outer" style={{ transformOrigin: '60px 60px' }}>
          <circle cx="60" cy="60" r="40" fill="none" stroke="url(#fire-outer-grad)" strokeWidth="7" filter="url(#fire-glow)" strokeDasharray="16 6 24 9 18 7 32 10" strokeLinecap="round" />
          <path d="M 60,12 C 64,12 67,17 64,21 C 60,24 56,20 54,16 C 56,14 58,12 60,12 Z" fill="url(#fire-outer-grad)" />
          <path d="M 108,60 C 108,64 103,67 99,64 C 96,60 100,56 104,54 C 106,56 108,58 108,60 Z" fill="url(#fire-outer-grad)" />
          <path d="M 60,108 C 56,108 53,103 56,99 C 60,96 64,100 66,104 C 64,106 62,108 60,108 Z" fill="url(#fire-outer-grad)" />
          <path d="M 12,60 C 12,56 17,53 21,56 C 24,60 20,64 18,66 C 16,64 12,62 12,60 Z" fill="url(#fire-outer-grad)" />
        </g>

        {/* Middle flame ring */}
        <g className="fire-ring-middle" style={{ transformOrigin: '60px 60px' }}>
          <circle cx="60" cy="60" r="38" fill="none" stroke="url(#fire-outer-grad)" strokeWidth="5.5" strokeDasharray="20 10 14 6 26 8" strokeLinecap="round" />
          <path d="M 85,35 C 88,32 91,37 87,41 C 84,44 80,40 82,36 Z" fill="url(#fire-outer-grad)" />
          <path d="M 35,85 C 32,88 37,91 41,87 C 44,84 40,80 36,82 Z" fill="url(#fire-outer-grad)" />
        </g>

        {/* Inner hot core ring */}
        <g className="fire-ring-inner" style={{ transformOrigin: '60px 60px' }}>
          <circle cx="60" cy="60" r="36" fill="none" stroke="url(#fire-inner-grad)" strokeWidth="4" strokeDasharray="10 5 18 5 12 7" strokeLinecap="round" filter="url(#fire-glow)" />
          <path d="M 60,19 C 62,19 63,22 61,24 C 60,26 58,24 58,22 Z" fill="url(#fire-inner-grad)" />
          <path d="M 91,50 C 93,50 94,53 92,55 C 90,57 88,55 88,53 Z" fill="url(#fire-inner-grad)" />
          <path d="M 60,91 C 58,91 57,88 59,86 C 60,84 62,86 62,88 Z" fill="url(#fire-inner-grad)" />
          <path d="M 29,50 C 27,50 26,53 28,55 C 30,57 32,55 32,53 Z" fill="url(#fire-inner-grad)" />
        </g>
      </svg>
    </>
  );
};
