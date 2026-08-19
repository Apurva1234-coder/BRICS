/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#060608",
        panel: "#0d0e13",
        surface: "#141519",
        line: "rgba(255,255,255,0.07)",
        civic: "#00e07a",
        aqua: "#00c9e8",
        accent: "#00e07a",
        warning: "#f59e0b",
        severe: "#ef4444",
        muted: "#64748b"
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 30px rgba(0,224,122,0.12)",
        panel: "0 8px 40px rgba(0,0,0,0.6)"
      }
    }
  },
  plugins: []
};
