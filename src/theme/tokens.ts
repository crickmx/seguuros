export const colors = {
  navy: '#202856',
  navyDeep: '#194988',
  greenAccent: '#65EA1E',
  greenAccentAlt: '#72EC1E',
  teal: '#017E7B',
  teal2: '#019871',
  linkNavy: '#2F4583',
  background: '#FFFFFF',
  surface: '#F7F8FC',
  border: '#E6E8EF',
  text: {
    primary: '#202856',
    secondary: '#4A5568',
    muted: '#718096',
    inverse: '#FFFFFF'
  },
  status: {
    success: '#65EA1E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#017E7B'
  }
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #194988 0%, #017E7B 45%, #65EA1E 100%)',
  subtle: 'linear-gradient(180deg, #F7F8FC 0%, #FFFFFF 100%)',
  overlay: 'linear-gradient(180deg, rgba(32, 40, 86, 0) 0%, rgba(32, 40, 86, 0.8) 100%)'
} as const;

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem'
} as const;

export const radius = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  full: '9999px'
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(32, 40, 86, 0.05)',
  md: '0 4px 6px -1px rgba(32, 40, 86, 0.1), 0 2px 4px -1px rgba(32, 40, 86, 0.06)',
  lg: '0 10px 15px -3px rgba(32, 40, 86, 0.1), 0 4px 6px -2px rgba(32, 40, 86, 0.05)',
  xl: '0 20px 25px -5px rgba(32, 40, 86, 0.1), 0 10px 10px -5px rgba(32, 40, 86, 0.04)'
} as const;

export const typography = {
  fontFamily: {
    base: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  lineHeight: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75'
  }
} as const;

export const breakpoints = {
  mobile: '360px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px'
} as const;

export const touchTarget = {
  min: '44px'
} as const;

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070
} as const;
