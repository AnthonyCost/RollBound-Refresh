import pg from 'pg';

// DATE columns come back as "2026-10-24" text, not a Date at midnight in the
// server's time zone (which can shift the day when sent on).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// Uses DATABASE_URL, e.g. postgres://user:password@localhost:5432/rollbound
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/rollbound',
});
