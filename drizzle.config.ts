import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/database/src/schema.ts',
  out: './packages/database/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/crm_next',
  },
  verbose: true,
  strict: true,
} satisfies Config;
