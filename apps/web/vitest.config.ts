import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Integration tests share one Postgres DB (crm_test) and wipe tables in
    // beforeAll/afterAll — files MUST run sequentially, otherwise they
    // delete each other's fixtures mid-run (flaky 401s).
    // crm_test is separate from crm_dev so tests never touch dev data.
    fileParallelism: false,
    env: {
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/crm_test',
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
