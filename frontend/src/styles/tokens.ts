export const colors = {
  primary: {
    50: "#fef7ed",
    100: "#fcecd5",
    200: "#f9d4a8",
    300: "#f5b56f",
    400: "#ef8c38",
    500: "#e8731a",
    600: "#d45a10",
    700: "#b0420f",
    800: "#8c3514",
    900: "#6e2c13",
  },
  secondary: {
    50: "#fef7ed",
    100: "#fcecd5",
    200: "#f9d4a8",
    300: "#f5b56f",
    400: "#ef8c38",
    500: "#e8731a",
    600: "#d45a10",
    700: "#b0420f",
    800: "#8c3514",
    900: "#6e2c13",
  },
  neutral: {
    0: "#fffbf5",
    50: "#faf5ed",
    100: "#f3ece1",
    200: "#e8ddd0",
    300: "#d6c7b5",
    400: "#b8a793",
    500: "#9a8874",
    600: "#7a6b5a",
    700: "#5c5044",
    800: "#3e3730",
    900: "#272220",
    1000: "#131110",
  },
  success: { light: "#dcfce7", main: "#16A34A", dark: "#166534" },
  warning: { light: "#fef3c7", main: "#D97706", dark: "#92400e" },
  error: { light: "#fee2e2", main: "#DC2626", dark: "#991b1b" },
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
  sm: "0px",
  md: "0px",
  lg: "0px",
  xl: "0px",
  full: "999px",
} as const;

export const shadows = {
  sm: "3px 3px 0 #272220",
  md: "6px 6px 0 #272220",
  lg: "8px 8px 0 #272220",
  xl: "12px 12px 0 #272220",
  rainbow:
    "4px 4px 0 #e8731a, 8px 8px 0 #ef8c38, 12px 12px 0 #272220",
} as const;
