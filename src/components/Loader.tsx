import React from 'react';
import '../styles/index.css';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', fullScreen = false }) => {
  const getDims = () => {
    switch (size) {
      case 'sm': return '24px';
      case 'lg': return '64px';
      case 'md':
      default: return '40px';
    }
  };

  const spinner = (
    <div style={{
      width: getDims(),
      height: getDims(),
      border: '4px solid var(--surface-hover)',
      borderTop: '4px solid var(--primary)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
  );

  return fullScreen ? (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(255,255,255,0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      {spinner}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  ) : (
    <div style={{ display: 'inline-block' }}>
      {spinner}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
