import { colors, radius, shadows, spacing, typography } from './tokens';

export const button = {
  primary: {
    background: colors.greenAccent,
    color: colors.navy,
    padding: `${spacing.md} ${spacing.xl}`,
    borderRadius: radius.lg,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    border: 'none',
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.2s ease',
    boxShadow: shadows.sm,
    ':hover': {
      background: colors.greenAccentAlt,
      transform: 'translateY(-1px)',
      boxShadow: shadows.md
    },
    ':active': {
      transform: 'translateY(0)'
    }
  },
  secondary: {
    background: colors.navy,
    color: colors.text.inverse,
    padding: `${spacing.md} ${spacing.xl}`,
    borderRadius: radius.lg,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    border: 'none',
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.2s ease',
    boxShadow: shadows.sm,
    ':hover': {
      background: colors.navyDeep,
      transform: 'translateY(-1px)',
      boxShadow: shadows.md
    }
  },
  ghost: {
    background: 'transparent',
    color: colors.navy,
    padding: `${spacing.md} ${spacing.xl}`,
    borderRadius: radius.lg,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.2s ease',
    ':hover': {
      background: colors.surface,
      borderColor: colors.navy
    }
  }
} as const;

export const input = {
  base: {
    width: '100%',
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.base,
    color: colors.text.primary,
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    outline: 'none',
    minHeight: '44px',
    transition: 'all 0.2s ease',
    ':focus': {
      borderColor: colors.teal,
      boxShadow: `0 0 0 3px ${colors.teal}20`
    },
    ':disabled': {
      background: colors.surface,
      cursor: 'not-allowed',
      opacity: 0.6
    }
  }
} as const;

export const card = {
  base: {
    background: colors.background,
    borderRadius: radius.xl,
    padding: spacing.lg,
    boxShadow: shadows.md,
    border: `1px solid ${colors.border}`,
    transition: 'all 0.2s ease'
  },
  hover: {
    background: colors.background,
    borderRadius: radius.xl,
    padding: spacing.lg,
    boxShadow: shadows.md,
    border: `1px solid ${colors.border}`,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    ':hover': {
      boxShadow: shadows.lg,
      transform: 'translateY(-2px)'
    }
  }
} as const;
