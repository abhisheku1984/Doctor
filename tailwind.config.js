/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#F0F4FA",
          100: "#DCE6F2",
          200: "#B9CCE4",
          300: "#8FAAD1",
          400: "#5F82B4",
          500: "#3D6196",
          600: "#2C4B7A",
          700: "#213A61",
          800: "#16294A",
          900: "#0C1B33",
          950: "#071224",
        },
        teal: {
          50: "#EFFAF8",
          100: "#D7F2EE",
          200: "#AEE5DE",
          300: "#7AD1C7",
          400: "#45B5AA",
          500: "#269A90",
          600: "#1B7D76",
          700: "#17645F",
          800: "#144F4C",
          900: "#114240",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(12, 27, 51, 0.05), 0 8px 24px -12px rgba(12, 27, 51, 0.18)",
        lift: "0 12px 32px -12px rgba(12, 27, 51, 0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.08)" },
        },
        "speak-mouth": {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(2.6)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        blink: "blink 4.2s ease-in-out infinite",
        "speak-mouth": "speak-mouth 0.28s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
