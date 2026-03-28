import React from 'react';
import '../styles/index.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2 | 3 | 4;
  noPadding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', elevation = 1, noPadding = false, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: `var(--shadow-${elevation})`,
          padding: noPadding ? '0' : 'var(--spacing-3)',
          transition: 'var(--transition-normal)',
          border: '1px solid var(--border-color)',
          ...style,
        }}
        className={`card ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
