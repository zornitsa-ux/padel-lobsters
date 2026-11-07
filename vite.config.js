import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { SITE_DESCRIPTION, SITE_IMAGE_PATH, SITE_NAME, SITE_URL } from './siteMeta.js'

// Opt-in bundle treemap. `npm run build:analyze` sets ANALYZE=true, which
// emits dist/stats.html (gzip + brotli sizes) and opens it. Off by default
// so normal/CI builds don't pay for it or leak the report into dist.
const analyze = process.env.ANALYZE === 'true'

const meta = (attr, key, content) => ({ tag: 'meta', attrs: { [attr]: key, content } })

// Site-wide link preview tags, from the text api/event-preview falls back to.
const siteMetaTags = () => ({
  name: 'site-meta-tags',
  transformIndexHtml: () => [
    meta('name', 'description', SITE_DESCRIPTION),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:title', SITE_NAME),
    meta('property', 'og:description', SITE_DESCRIPTION),
    meta('property', 'og:url', SITE_URL),
    meta('property', 'og:image', `${SITE_URL}${SITE_IMAGE_PATH}`),
    meta('name', 'twitter:card', 'summary'),
  ],
})

export default defineConfig({
  plugins: [
    react(),
    siteMetaTags(),
    analyze &&
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: true,
      }),
  ],
  // Pin the dev host and port. Auth + Supabase config.toml are tied to
  // http://127.0.0.1:5173 (site_url, redirect allow-list, and the
  // magic-link email template).
  //
  // host: '127.0.0.1' — Vite's default 'localhost' can resolve to IPv6
  //   ::1 only on some macOS configurations, leaving 127.0.0.1 unreachable
  //   even though it seems like it should work. Pin the IPv4 loopback so
  //   the URL in the email actually points at this dev server.
  // strictPort: true — fail loudly if 5173 is already taken rather than
  //   drift to 5174 and silently break confirmation links.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split the slow-moving libraries into their own vendor chunk so app
        // code changes don't bust their long-term cache. React + router are
        // needed for first paint; supabase/query are still entry-critical
        // (AppContext boots data on mount) so they ride along here too.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.{js,jsx,ts,tsx}',
      'api/**/*.test.{ts,tsx}',
      'scripts/prod-rehearsal/*.test.ts',
    ],
  },
})
