import React from 'react';

interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ children, hover = false, onClick, style, className }: CardProps) {
  const baseStyles: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '1.25rem',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(32, 40, 86, 0.1), 0 2px 4px -1px rgba(32, 40, 86, 0.06)',
    border: '1px solid #E6E8EF',
    transition: 'all 0.2s ease',
  };

  const hoverStyles: React.CSSProperties = hover ? {
    cursor: 'pointer',
  } : {};

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        ...baseStyles,
        ...hoverStyles,
        ...style
      }}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(32, 40, 86, 0.1), 0 4px 6px -2px rgba(32, 40, 86, 0.05)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(32, 40, 86, 0.1), 0 2px 4px -1px rgba(32, 40, 86, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {children}
    </div>
  );
}
