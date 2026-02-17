import React from 'react';

interface LoadingAnimationProps {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingAnimation({ size = 'md' }: LoadingAnimationProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-12 h-12',
    lg: 'w-24 h-24'
  };

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="w-full h-full border-4 border-[#1B7F7F] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="absolute top-1/2 left-1/2 flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <svg
            className="w-1/2 h-1/2 text-[#1B7F7F]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
