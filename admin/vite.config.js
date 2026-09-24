import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 3101, strictPort: true },
  preview: { port: 3101, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Firebase is the bulk of the download and changes rarely, so it caches separately.
        manualChunks: { firebase: ["firebase/app", "firebase/auth"] },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx}"],
    setupFiles: ["src/test/setup.js"],
    // One jsdom environment shared across files instead of one per file: cuts spin-up overhead that
    // was making slower assertions flaky under load (see client/vite.config.js for the same change).
    isolate: false,
  },
});
