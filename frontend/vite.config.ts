/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Used only when mocks are off (VITE_USE_MOCKS=false). Set to your API address.
    // 127.0.0.1, not localhost: on Windows localhost tries IPv6 first and adds ~200 ms per request.
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Pin the time zone so location-based defaults do not depend on the machine running tests.
    env: { TZ: 'UTC' },
  },
})
