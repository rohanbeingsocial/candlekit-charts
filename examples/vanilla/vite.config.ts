import { defineConfig } from "vite";
import { candlekitAlias } from "../shared/vite.shared";

export default defineConfig({
  resolve: { alias: candlekitAlias },
  server: { fs: { strict: false } },
});
