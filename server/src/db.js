import pg from 'pg';

// Uses DATABASE_URL, e.g. postgres://user:password@localhost:5432/rollbound
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/rollbound',
});
