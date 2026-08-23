import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Keep frontend and backend configuration in this checkout's .env file.
  envDir: ".",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    hmr: { host: "127.0.0.1", clientPort: 5173 },
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/media": { target: "http://127.0.0.1:8787", changeOrigin: true }
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
});
