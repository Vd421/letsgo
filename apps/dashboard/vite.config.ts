// Vite settings for the dashboard: which plugins to use, and which port to run on.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // react(): understands JSX (the HTML-like code in .tsx files).
  // tailwindcss(): turns Tailwind labels like "p-4" into real CSS.
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 is the demo shop, so the dashboard uses the next door along.
    // strictPort: fail instead of quietly picking another port (the API's CORS only allows 5174).
    port: 5174,
    strictPort: true,
  },
});
