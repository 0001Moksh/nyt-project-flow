import React from 'react';
import { useToastStore } from '../utils/toastStore';
import { XCircle, CheckCircle, Info, X } from 'lucide-react';
import '../styles/index.css';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 9999
    }}>
      {toasts.map((toast) => {
        let bgColor, icon;
        switch (toast.type) {
          case 'success':
            bgColor = 'var(--secondary)';
            icon = <CheckCircle size={20} color="white" />;
            break;
          case 'error':
            bgColor = 'var(--danger)';
            icon = <XCircle size={20} color="white" />;
            break;
          case 'info':
          default:
            bgColor = 'var(--primary)';
            icon = <Info size={20} color="white" />;
            break;
        }

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: '250px',
              backgroundColor: bgColor,
              color: 'white',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-3)',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {icon}
              <span style={{ fontWeight: 500 }}>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                opacity: 0.8,
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
