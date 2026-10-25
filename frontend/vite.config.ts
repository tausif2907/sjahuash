import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// In development the React app calls /api on its own origin and Vite forwards it to
// FastAPI. Set API_PROXY_TARGET if the backend is not on localhost:8000.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
