import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { candlekitResolve } from "../shared/vite.shared";

export default defineConfig({
  plugins: [react()],
  resolve: candlekitResolve,
  server: { fs: { strict: false } },
});
