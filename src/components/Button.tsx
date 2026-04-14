import React from 'react';
import '../styles/index.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Generate inline styles based on variant
    const getBaseStyles = (): React.CSSProperties => {
      const base: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-1)',
        fontWeight: 500,
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        border: '1px solid transparent',
        width: fullWidth ? '100%' : 'auto',
      };

      // Size variations
      switch (size) {
        case 'sm':
          base.padding = '6px 16px';
          base.fontSize = '14px';
          break;
        case 'md':
          base.padding = '8px 24px';
          base.fontSize = '16px';
          break;
        case 'lg':
          base.padding = '12px 32px';
          base.fontSize = '18px';
          break;
      }

      return base;
    };

    const getVariantClasses = () => {
      // In a real app we might use a dedicated CSS module or clsx/tailwind
      // Since we are pure vanilla CSS per instructions with dynamic styles:
      return `btn btn-${variant}`;
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={getBaseStyles()}
        className={`${getVariantClasses()} ${className}`}
        {...props}
      >
        {isLoading && <span className="btn-spinner" />}
        {!isLoading && leftIcon && <span className="btn-icon">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="btn-icon">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
