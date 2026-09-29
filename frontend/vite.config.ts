import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev: proxy /api ไป backend port 4000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
