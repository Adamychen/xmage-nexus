import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    plugins: [react()],
    base: process.env.TAURI_BUILD || demo ? './' : '/',
    define: { __DEMO__: JSON.stringify(demo) },
    build: demo ? { outDir: 'dist-demo' } : undefined,
    server: {
      port: 5173,
      proxy: {
        '/ranking.json': {
          target: 'https://web.xmage-nexus.com',
          changeOrigin: true,
        },
      },
    },
  }
})
