import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@fluentui-contrib/react-prompts': fileURLToPath(new URL('../../packages/react-prompts/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5187,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3017', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:3017', changeOrigin: true } },
  },
})
