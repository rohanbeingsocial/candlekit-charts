import { defineConfig } from "vite";
import { candlekitResolve } from "../shared/vite.shared";

export default defineConfig({
  resolve: candlekitResolve,
  server: { fs: { strict: false } },
});
