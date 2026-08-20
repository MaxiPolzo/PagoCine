import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        meadow: "#0F8F72",
        sun: "#F6B84B",
        coral: "#E86955"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 32, 51, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
