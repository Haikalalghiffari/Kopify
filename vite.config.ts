// vite.config.ts - Added alias for '@/...'
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, 'src') + '/',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Ensure Vitest picks up the alias
    alias: {
      '@/': path.resolve(__dirname, 'src') + '/',
    },
  },
});