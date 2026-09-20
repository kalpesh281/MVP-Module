import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 is a Vite plugin, not a PostCSS step — there is no
// tailwind.config.js. The design tokens live in src/index.css under
// @theme, which is where the scorecard's colours are defined.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5174, not the Vite default. Another dev server already holds 5173 on
    // this machine, and `strictPort` makes the clash loud instead of
    // silently moving us to a port the proxy note below no longer matches.
    port: 5174,
    strictPort: true,
    // The scan endpoint is Server-Sent Events. Proxying it in development
    // keeps the browser on one origin, so EventSource needs no CORS
    // preflight and cookies behave the same as in production.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
