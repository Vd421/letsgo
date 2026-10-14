// Vite settings for the dashboard: which plugins to use, which port to run on, and what Vitest skips.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // react(): understands JSX (the HTML-like code in .tsx files).
  // tailwindcss(): turns Tailwind labels like "p-4" into real CSS.
  plugins: [react(), tailwindcss()],
  // The Playwright browser tests in e2e/ have their own runner (npm run e2e); Vitest must not run them.
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
  server: {
    // 5173 is the demo shop, so the dashboard uses the next door along.
    // strictPort: fail instead of quietly picking another port (the API's CORS only allows 5174).
    port: 5174,
    strictPort: true,
  },
});
