import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/login": "http://localhost:3000",
      "/register": "http://localhost:3000",
      "/approval": "http://localhost:3000",
      "/vehicles": "http://localhost:3000",
      "/fuel-planning": "http://localhost:3000",
    },
  },
});
