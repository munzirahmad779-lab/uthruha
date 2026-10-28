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
        // Palet Kitabah (dari galeri logo): jangkar ink-900 = Coklat Tinta
        // #4A3A22 (tombol utama + teks utama), gold-500 = Emas #D9A441
        // (aksen saja, bukan teks biasa), parchment-50 = Kertas Gading
        // #FAF6EB (latar halaman). Seluruh tangga diturunkan dari jangkar itu.
        ink: {
          50: "#f8f4ea",
          100: "#efe6cf",
          200: "#dfcda6",
          300: "#bfa26b",
          400: "#9c8148",
          500: "#8a6f3b",
          600: "#71592d",
          700: "#5d4a26",
          800: "#544324",
          900: "#4a3a22",
          950: "#2f2312",
        },
        gold: {
          100: "#faefce",
          200: "#f4e0a4",
          300: "#ecc978",
          400: "#e3b356",
          500: "#d9a441",
          600: "#b4832c",
        },
        parchment: {
          50: "#faf6eb",
          100: "#f6efdc",
          200: "#f0e4c6",
          300: "#e5d3a4",
          400: "#d6bc7c",
        },
      },
      fontFamily: {
        sans: ["var(--font-latin)", "ui-sans-serif", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "Traditional Arabic", "serif"],
        naskh: ["var(--font-naskh)", "Amiri", "Traditional Arabic", "serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(74,58,34,0.05), 0 10px 30px -18px rgba(74,58,34,0.35)",
        lift: "0 24px 60px -32px rgba(74,58,34,0.55)",
      },
      backgroundImage: {
        "grain":
          "radial-gradient(circle at 1px 1px, rgba(74,58,34,0.09) 1px, transparent 0)",
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
