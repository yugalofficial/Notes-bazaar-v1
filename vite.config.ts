import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates GitHub Pages compatibility artifacts inside dist/:
 * 1. `.nojekyll` so GitHub Pages never strips `_` or asset folders.
 * 2. Smart `404.html` that cleanly preserves deep non-hash links (e.g. /RepoName/shop or /RepoName/product/xyz)
 *    by redirecting to the GitHub Pages root + `#/route` so relative `./assets/*` bundles never 404.
 */
function githubPagesCompatPlugin(): Plugin {
  return {
    name: 'github-pages-spa-compat',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const fallbackHtml = path.join(distDir, '404.html');
      const nojekyll = path.join(distDir, '.nojekyll');

      if (fs.existsSync(distDir)) {
        const smart404Html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NotesBazaar – Redirecting…</title>
  <script>
    (function () {
      var l = window.location;
      var segments = l.pathname.split('/').filter(Boolean);
      var appRoutes = ['shop', 'product', 'membership', 'about', 'contact', 'privacy', 'terms', 'login', 'register', 'dashboard', 'admin', 'admin-login', 'thank-you'];
      var firstIsRoute = segments.length > 0 && appRoutes.indexOf(segments[0].toLowerCase()) !== -1;
      var isGhPagesProject = l.hostname.endsWith('.github.io') && segments.length >= 1 && !firstIsRoute;
      var basePath = isGhPagesProject ? '/' + segments[0] + '/' : '/';
      var routeParts = isGhPagesProject ? segments.slice(1) : segments;
      var subRoute = routeParts.join('/');
      var search = l.search || '';
      var hashRoute = l.hash && l.hash.startsWith('#/')
        ? l.hash
        : (subRoute ? '#/' + subRoute + search : '#/');
      l.replace(l.origin + basePath + hashRoute);
    })();
  </script>
</head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#020617;color:#f8fafc;">
  <div style="text-align:center;padding:24px;">
    <p style="font-weight:700;margin:0 0 8px;">Redirecting to NotesBazaar…</p>
    <a href="./" style="color:#14b8a6;font-size:14px;">Click here if you are not redirected automatically</a>
  </div>
</body>
</html>`;
        fs.writeFileSync(fallbackHtml, smart404Html, 'utf-8');
        if (!fs.existsSync(nojekyll)) {
          fs.writeFileSync(nojekyll, '');
        }
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: command === 'build' ? './' : '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: false,
      ws: false,
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'motion-icons': ['motion', 'lucide-react'],
            'charts-pdf': ['recharts', 'jspdf', 'html2canvas'],
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [],
        manifest: {
          id: './',
          name: 'NotesBazaar – Exam Prep & Study Material',
          short_name: 'NotesBazaar',
          description:
            'Concise, exam-oriented handwritten digital PDF notes for SSC, Banking, Railways, State PSC, and UPSC.',
          theme_color: '#0D9488',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: './',
          scope: './',
          categories: ['education', 'books', 'productivity'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/404.html'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'firestore-data-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      githubPagesCompatPlugin(),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
