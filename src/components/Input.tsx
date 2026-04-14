import React from 'react';
import '../styles/index.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className={`input-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
        {label && (
          <label htmlFor={inputId} style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {label}
          </label>
        )}
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {leftIcon && (
            <span style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }}>
              {leftIcon}
            </span>
          )}
          
          <input
            ref={ref}
            id={inputId}
            style={{
              width: '100%',
              padding: `12px ${rightIcon ? '40px' : '12px'} 12px ${leftIcon ? '40px' : '12px'}`,
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
              fontSize: '16px',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--surface)',
              transition: 'var(--transition-fast)',
              outline: 'none',
              boxShadow: 'none',
            }}
            onFocus={(e) => {
              if (!error) e.target.style.border = '1px solid var(--primary)';
            }}
            onBlur={(e) => {
              if (!error) e.target.style.border = '1px solid var(--border-color)';
            }}
            {...props}
          />
          
          {rightIcon && (
            <span style={{ position: 'absolute', right: '12px', color: 'var(--text-secondary)' }}>
              {rightIcon}
            </span>
          )}
        </div>

        {(error || helperText) && (
          <span style={{ fontSize: '12px', color: error ? 'var(--danger)' : 'var(--text-secondary)' }}>
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
