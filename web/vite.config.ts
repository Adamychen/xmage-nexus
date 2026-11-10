import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    plugins: [react()],
    base: process.env.TAURI_BUILD ? './' : '/',
    build: {
      // A font small enough to inline would become a data: URL, which the proxy's CSP blocks
      // (APR-5); fonts always stay files.
      assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
    server: {
      port: 5173,
      watch: {
        ignored: ['**/test-results*/**', '**/playwright-report/**', '**/e2e/shots/**', '**/dist/**'],
      },
      proxy: {
        '/ranking.json': {
          target: 'https://web.xmage-nexus.com',
          changeOrigin: true,
        },
      },
    },
  }
})
