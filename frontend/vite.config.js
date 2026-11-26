
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = "http://localhost:3000";

const apiRoutes = [
  "/login",
  "/register",
  "/approval",
  "/rejected",
  "/deactivated",
  "/reactivate",
  "/get-pending-users",
  "/get-all-users",
  "/get-deactivated-users",
  "/vehicles",
  "/fuel-planning",
];

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: Object.fromEntries(
      apiRoutes.map((route) => [route, backendTarget]),
    ),
  },
});
