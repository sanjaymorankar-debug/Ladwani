import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          DEFAULT: "#FF6B00",
          50: "#FFF3E9",
          100: "#FFE3C9",
          200: "#FFC699",
          300: "#FFA452",
          400: "#FF8C3B",
          500: "#FF6B00",
          600: "#D45A00",
          700: "#A84600",
          800: "#7C3400",
          900: "#502100",
        },
        navy: {
          DEFAULT: "#1B2A4A",
          50: "#EEF1F8",
          100: "#D4DBF0",
          200: "#A9B7E1",
          300: "#7E93D2",
          400: "#536FC3",
          500: "#2D4B94",
          600: "#1B2A4A",
          700: "#152238",
          800: "#0F1926",
          900: "#090F17",
        },
        green: {
          india: "#138808",
        },
        cream: "#FFFBF5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        devanagari: ["Noto Sans Devanagari", "sans-serif"],
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
