import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@q7/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@q7/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 3041,
    host: '0.0.0.0',
    allowedHosts: ['obras02.local', 'localhost', '.local'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
