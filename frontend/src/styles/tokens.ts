export const colors = {
  primary: {
    50: "#fef3e2",
    100: "#fde4b9",
    200: "#fcd48c",
    300: "#fbc45f",
    400: "#fab83d",
    500: "#f9ac1b",
    600: "#e89a17",
    700: "#c98112",
    800: "#aa680e",
    900: "#7b4a09",
  },
  secondary: {
    50: "#e8f5e9",
    100: "#c8e6c9",
    200: "#a5d6a7",
    300: "#81c784",
    400: "#66bb6a",
    500: "#4caf50",
    600: "#43a047",
    700: "#388e3c",
    800: "#2e7d32",
    900: "#1b5e20",
  },
  neutral: {
    0: "#ffffff",
    50: "#f8f9fa",
    100: "#f1f3f5",
    200: "#e9ecef",
    300: "#dee2e6",
    400: "#ced4da",
    500: "#adb5bd",
    600: "#6c757d",
    700: "#495057",
    800: "#343a40",
    900: "#212529",
    1000: "#000000",
  },
  success: { light: "#d4edda", main: "#28a745", dark: "#1e7e34" },
  warning: { light: "#fff3cd", main: "#ffc107", dark: "#d39e00" },
  error: { light: "#f8d7da", main: "#dc3545", dark: "#bd2130" },
} as const;

export const darkColors = {
  neutral: {
    0: "#1a1a2e",
    50: "#16213e",
    100: "#0f3460",
    200: "#1a1a2e",
    300: "#222244",
    400: "#333355",
    500: "#555577",
    600: "#777799",
    700: "#9999bb",
    800: "#bbbbdd",
    900: "#ddddef",
    1000: "#ffffff",
  },
} as const;

export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const spacing = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

export const borderRadius = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px rgba(0, 0, 0, 0.07)",
  lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px rgba(0, 0, 0, 0.15)",
} as const;

export const elevation = {
  base: 0,
  raised: 1,
  overlay: 2,
  modal: 3,
  toast: 4,
} as const;

export const breakpoints = {
  xs: "320px",
  sm: "768px",
  md: "1024px",
  lg: "1440px",
  xl: "2560px",
} as const;

export const mediaQueries = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
  largeDesktop: "(min-width: 1440px)",
} as const;
