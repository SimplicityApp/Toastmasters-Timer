import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: {
      '@toastmaster-timer/shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
});
