import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f2f5f4",
          100: "#dde5e2",
          200: "#b9c9c3",
          400: "#4d6f66",
          600: "#245045",
          700: "#143c33",
          800: "#0e2c26",
          900: "#0a211c",
          950: "#061713",
        },
        gold: {
          100: "#f8eecb",
          200: "#f0dda0",
          300: "#e5c877",
          400: "#d6b052",
          500: "#c39b32",
          600: "#a17c22",
        },
        parchment: {
          50: "#fdfbf5",
          100: "#faf5e8",
          200: "#f3ebd7",
          300: "#e8dcbf",
          400: "#d8c69c",
        },
      },
      fontFamily: {
        sans: ["var(--font-latin)", "ui-sans-serif", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "Traditional Arabic", "serif"],
        naskh: ["var(--font-naskh)", "Amiri", "Traditional Arabic", "serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(10,33,28,0.04), 0 10px 30px -18px rgba(10,33,28,0.35)",
        lift: "0 24px 60px -32px rgba(10,33,28,0.55)",
      },
      backgroundImage: {
        "grain":
          "radial-gradient(circle at 1px 1px, rgba(14,44,38,0.09) 1px, transparent 0)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) rotate(0deg)" },
          "50%": { transform: "translate3d(0,-10px,0) rotate(1.5deg)" },
        },
      },
      animation: {
        rise: "rise 0.6s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 9s linear infinite",
        drift: "drift 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
