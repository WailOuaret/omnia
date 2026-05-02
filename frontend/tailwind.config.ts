import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#111318",
        surface: "#181C23",
        border: "#303845",
        muted: "#A4AFBE",
        accent: "#2F80ED",
        cyan: "#20C7D4",
        green: "#16A34A",
        red: "#EF4444",
        pink: "#EC4899",
        ink: "#F4F7FB",
        slateDeep: "#D5DCE7",
        steel: "#20C7D4",
        moss: "#16A34A",
        amber: "#F59E0B",
        ember: "#EF4444",
        sand: "#F59E0B",
        violet: "#8B5CF6",
        mist: "#111318",
        panel: "#181C23",
      },
      boxShadow: {
        panel: "0 14px 34px rgba(0, 0, 0, 0.24)",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Consolas", "Courier", "monospace"],
      },
      borderRadius: {
        card: "8px",
      },
      backgroundImage: {
        haze: "linear-gradient(180deg, #111318 0%, #0D0F14 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
