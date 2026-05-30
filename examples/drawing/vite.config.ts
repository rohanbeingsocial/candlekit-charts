import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { candlekitAlias } from "../shared/vite.shared";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: candlekitAlias },
  server: { fs: { strict: false } },
});
