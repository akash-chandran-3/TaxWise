import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api/* to the Express server, so the browser sees a single origin.
    // API_URL lets you point at an API running on another port.
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:5000',
    },
  },
});
