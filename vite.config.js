import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
})
