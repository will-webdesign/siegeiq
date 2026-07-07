import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const r = (rel: string) => path.resolve(__dirname, rel);

/** Multi-window Overwolf build: each window is its own HTML entry. */
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: r("src") + "/$1" },
      { find: /^@siegeiq\/shared$/, replacement: r("../../packages/shared/src/index.ts") },
      { find: /^@siegeiq\/shared\/(.*)$/, replacement: r("../../packages/shared/src") + "/$1" },
      { find: /^@siegeiq\/game-data$/, replacement: r("../../packages/game-data/src/index.ts") },
      { find: /^@siegeiq\/game-data\/(.*)$/, replacement: r("../../packages/game-data/src") + "/$1" },
      { find: /^@siegeiq\/coaching$/, replacement: r("../../packages/coaching/src/index.ts") },
      { find: /^@siegeiq\/coaching\/(.*)$/, replacement: r("../../packages/coaching/src") + "/$1" }
    ]
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        background: r("background.html"),
        desktop: r("desktop.html"),
        ingame: r("ingame.html")
      }
    }
  }
});
