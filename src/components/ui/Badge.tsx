import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    success: {
      background: 'rgba(101, 234, 30, 0.1)',
      color: '#017E7B',
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.1)',
      color: '#B45309',
    },
    error: {
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#DC2626',
    },
    info: {
      background: 'rgba(1, 126, 123, 0.1)',
      color: '#017E7B',
    },
    default: {
      background: 'rgba(32, 40, 86, 0.1)',
      color: '#202856',
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        ...variantStyles[variant],
        ...style
      }}
    >
      {children}
    </span>
  );
}
