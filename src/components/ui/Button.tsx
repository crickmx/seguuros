import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  style,
  ...props
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    border: 'none',
    borderRadius: '1rem',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    minHeight: '44px',
    width: fullWidth ? '100%' : 'auto',
    opacity: props.disabled ? 0.6 : 1,
  };

  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
    md: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
    lg: { padding: '1rem 2rem', fontSize: '1.125rem' }
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: '#65EA1E',
      color: '#202856',
      boxShadow: '0 1px 2px 0 rgba(32, 40, 86, 0.05)',
    },
    secondary: {
      background: '#202856',
      color: '#FFFFFF',
      boxShadow: '0 1px 2px 0 rgba(32, 40, 86, 0.05)',
    },
    ghost: {
      background: 'transparent',
      color: '#202856',
      border: '1px solid #E6E8EF',
    },
    danger: {
      background: '#EF4444',
      color: '#FFFFFF',
      boxShadow: '0 1px 2px 0 rgba(32, 40, 86, 0.05)',
    }
  };

  return (
    <button
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
}
