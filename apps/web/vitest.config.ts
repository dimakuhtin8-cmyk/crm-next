import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Integration tests share one SQLite DB (dev.db) and wipe tables in
    // beforeAll/afterAll — files MUST run sequentially, otherwise they
    // delete each other's fixtures mid-run (flaky 401s).
    fileParallelism: false,
    env: {
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@crm-next/database': path.resolve(import.meta.dirname, '../../packages/database/src'),
      '@crm-next/types': path.resolve(import.meta.dirname, '../../packages/types/src'),
    },
  },
});
