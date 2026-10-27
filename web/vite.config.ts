import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    plugins: [react()],
    base: process.env.TAURI_BUILD ? './' : '/',
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
