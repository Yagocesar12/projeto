import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ghost Light Design System
        background: {
          DEFAULT: "#F7F7F5",
          secondary: "#FAFAF9",
          tertiary: "#F2F2EF",
          card: "#FFFFFF",
          hover: "#EEEEEB",
        },
        border: {
          DEFAULT: "#E7E7E4",
          strong: "#D8D8D4",
          focus: "#1A1A1A",
        },
        text: {
          primary: "#18181A",
          secondary: "#6B6B70",
          muted: "#98989D",
          disabled: "#C4C4C0",
        },
        accent: {
          black: "#1A1A1A",
          "black-soft": "#2C2C2E",
        },
        status: {
          success: "#16A34A",
          "success-bg": "#F0FDF4",
          "success-border": "#BBF7D0",
          warning: "#CA8A04",
          "warning-bg": "#FEFCE8",
          "warning-border": "#FEF08A",
          error: "#DC2626",
          "error-bg": "#FEF2F2",
          "error-border": "#FECACA",
          info: "#2563EB",
          "info-bg": "#EFF6FF",
          "info-border": "#BFDBFE",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)",
        "card-hover": "0 2px 8px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)",
        modal: "0 20px 60px 0 rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
        dropdown: "0 4px 16px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)",
        sm: "0 1px 2px rgba(0,0,0,0.05)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in-right": "slideInRight 0.25s ease-out",
        "slide-in-left": "slideInLeft 0.25s ease-out",
        "scale-in": "scaleIn 0.18s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "ghost-float": "ghostFloat 42s ease-in-out infinite alternate",
        "page-enter": "pageEnter 0.3s ease-out",
        "stagger-1": "fadeSlideUp 0.3s ease-out 0.05s both",
        "stagger-2": "fadeSlideUp 0.3s ease-out 0.1s both",
        "stagger-3": "fadeSlideUp 0.3s ease-out 0.15s both",
        "stagger-4": "fadeSlideUp 0.3s ease-out 0.2s both",
        "stagger-5": "fadeSlideUp 0.3s ease-out 0.25s both",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideInRight: { from: { opacity: "0", transform: "translateX(12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        slideInLeft: { from: { opacity: "0", transform: "translateX(-12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        ghostFloat: {
          "0%": { transform: "translateX(0) translateY(0)", opacity: "0.025" },
          "50%": { transform: "translateX(18px) translateY(-8px)", opacity: "0.04" },
          "100%": { transform: "translateX(30px) translateY(-12px)", opacity: "0.02" },
        },
        pageEnter: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeSlideUp: { from: { opacity: "0", transform: "translateY(5px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
