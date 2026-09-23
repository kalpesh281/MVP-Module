import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 is a Vite plugin, not a PostCSS step — there is no
// tailwind.config.js. The design tokens live in src/index.css under
// @theme, which is where the scorecard's colours are defined.
const UNUSED = fileURLToPath(new URL('./src/utils/pdf/unused.js', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: [
      // jsPDF ships optional integrations it only reaches for if you call
      // `.html()` or feed it an SVG. We do neither — `utils/pdf` draws
      // every line itself — but the bare `import()` calls are enough for
      // Rollup to bundle 350KB of html2canvas, canvg and dompurify that no
      // code path can ever run. Stubbed to an empty module.
      //
      // Must be an absolute filesystem path. A root-relative '/src/...'
      // resolves fine in `vite build`, but dependency pre-bundling runs
      // the alias from inside node_modules/jspdf, where it becomes
      // ../../../../../src/... and the dev server dies on startup.
      { find: /^html2canvas$/, replacement: UNUSED },
      { find: /^canvg$/, replacement: UNUSED },
      { find: /^dompurify$/, replacement: UNUSED },
    ],
  },
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
