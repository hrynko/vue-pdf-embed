import * as path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

module.exports = defineConfig({
  plugins: [vue()],
  build: {
    entry: path.resolve(__dirname, "demo/index.js"),
    outDir: path.resolve(__dirname, "demo/dist"),
    emptyOutDir: true,
    minify: false,
  },
  // worker: {
  //   format: "es",
  //   rollupOptions: {
  //     output: {
  //       entryFileNames: "worker.js",
  //     },
  //   },
  // },
});
