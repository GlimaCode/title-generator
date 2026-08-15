import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Lightweight local dev setup. Opens on http://localhost:5173 by default.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
