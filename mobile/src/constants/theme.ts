export const palette = {
  // Core Warm Civic Surfaces & Typography
  canvas: '#faf7f0',
  paper: '#faf7f0',
  paperAlt: '#f2ede1',
  surface: '#ffffff',
  surfaceMuted: '#f2ede1',
  card: '#ffffff',
  ink: '#14231c',
  text: '#14231c',
  textSecondary: '#46564d',
  muted: '#78857d',
  border: '#e6dfcf',
  borderStrong: '#d4ccb8',

  // Brand & Action Colors (Ghana Green & Road-Marking Gold)
  primary: '#0b6b45',
  primaryDark: '#073f2a',
  primarySoft: '#e1f0e6',
  accent: '#f0b429',
  accentSoft: '#fbefce',

  // Workflow Status Colors
  success: '#0b6b45',
  successSoft: '#e1f0e6',
  warning: '#b7791f',
  warningSoft: '#fbefce',
  danger: '#c8372d',
  dangerSoft: '#fbe3e0',
  info: '#2f6aa0',
  infoSoft: '#e1ecf6',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
  xxl: 44,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const Colors = {
  light: {
    text: palette.ink,
    background: palette.canvas,
    tint: palette.primary,
    icon: palette.muted,
    tabIconDefault: palette.muted,
    tabIconSelected: palette.primary,
  },
  dark: {
    text: palette.ink,
    background: palette.canvas,
    tint: palette.primary,
    icon: palette.muted,
    tabIconDefault: palette.muted,
    tabIconSelected: palette.primary,
  },
};