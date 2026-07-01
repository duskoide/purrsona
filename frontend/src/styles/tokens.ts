export const colors = {
  primary: {
    50: "#eee8ff",
    100: "#d9ccff",
    200: "#b599ff",
    300: "#8e66ff",
    400: "#6b33ff",
    500: "#4502FF",
    600: "#3a02d9",
    700: "#2f02b3",
    800: "#24018c",
    900: "#1a0166",
  },
  secondary: {
    50: "#fffce6",
    100: "#fff8c2",
    200: "#fff18a",
    300: "#ffe94d",
    400: "#FFDA14",
    500: "#e6c400",
    600: "#b39a00",
    700: "#806e00",
    800: "#4d4200",
    900: "#1a1600",
  },
  neutral: {
    0: "#FFFFFF",
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    1000: "#030712",
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
  sm: "3px 3px 0 #111827",
  md: "6px 6px 0 #111827",
  lg: "8px 8px 0 #111827",
  xl: "12px 12px 0 #111827",
  rainbow:
    "4px 4px 0 #4502FF, 8px 8px 0 #FFDA14, 12px 12px 0 #111827",
} as const;
