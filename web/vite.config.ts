import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.TAURI_BUILD ? './' : '/',
  server: {
    port: 5173,
  },
})
