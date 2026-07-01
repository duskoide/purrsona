import type { Config } from "tailwindcss";
import { colors, spacing, borderRadius, shadows } from "./src/styles/tokens";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        secondary: colors.secondary,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
      },
      spacing,
      borderRadius,
      boxShadow: {
        sm: shadows.sm,
        md: shadows.md,
        lg: shadows.lg,
        xl: shadows.xl,
        rainbow: shadows.rainbow,
        "press-sm": "3px 3px 0 #111827",
        "press-md": "6px 6px 0 #111827",
        "press-lg": "8px 8px 0 #111827",
      },
      fontFamily: {
        sans: ['"VT323"', "monospace"],
        mono: ['"JetBrains Mono"', "monospace"],
        display: ['"VT323"', "monospace"],
      },
      fontSize: {
        xs: ["13px", { lineHeight: "1.2" }],
        sm: ["15px", { lineHeight: "1.3" }],
        base: ["17px", { lineHeight: "1.4" }],
        lg: ["21px", { lineHeight: "1.3" }],
        xl: ["27px", { lineHeight: "1.2" }],
        "2xl": ["35px", { lineHeight: "1.1" }],
        "3xl": ["45px", { lineHeight: "1.1" }],
        "4xl": ["55px", { lineHeight: "1" }],
      },
      screens: {
        xs: "320px",
        sm: "768px",
        md: "1024px",
        lg: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
