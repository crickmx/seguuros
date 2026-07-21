import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, style, ...props }: InputProps) {
  const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontFamily: 'Inter, sans-serif',
    color: '#202856',
    background: '#FFFFFF',
    border: `1px solid ${error ? '#EF4444' : '#E6E8EF'}`,
    borderRadius: '0.75rem',
    outline: 'none',
    minHeight: '44px',
    transition: 'all 0.2s ease',
    ...style
  };

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#202856',
          marginBottom: '0.5rem'
        }}>
          {label}
        </label>
      )}
      <input style={inputStyles} {...props} />
      {error && (
        <p style={{
          marginTop: '0.25rem',
          fontSize: '0.875rem',
          color: '#EF4444'
        }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p style={{
          marginTop: '0.25rem',
          fontSize: '0.875rem',
          color: '#718096'
        }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
