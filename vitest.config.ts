import { defineConfig } from "vitest/config";
import path from "node:path";

const p = (rel: string) => path.resolve(__dirname, rel);

export default defineConfig({
  test: { include: ["tests/**/*.test.ts", "apps/desktop/src/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: [
      { find: /^@siegeiq\/shared$/, replacement: p("packages/shared/src/index.ts") },
      { find: /^@siegeiq\/shared\/(.*)$/, replacement: p("packages/shared/src") + "/$1" },
      { find: /^@siegeiq\/game-data$/, replacement: p("packages/game-data/src/index.ts") },
      { find: /^@siegeiq\/game-data\/(.*)$/, replacement: p("packages/game-data/src") + "/$1" },
      { find: /^@siegeiq\/coaching$/, replacement: p("packages/coaching/src/index.ts") },
      { find: /^@siegeiq\/coaching\/(.*)$/, replacement: p("packages/coaching/src") + "/$1" },
      { find: /^@siegeiq\/server$/, replacement: p("packages/server/src/index.ts") },
      { find: /^@siegeiq\/server\/(.*)$/, replacement: p("packages/server/src") + "/$1" }
    ]
  }
});
