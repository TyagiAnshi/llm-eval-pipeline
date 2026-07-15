// Vercel serverless entrypoint. Vercel's zero-config detection only serves
// the static `dist/` build for a Vite project — it has no idea `server.ts`
// exists unless something under `/api` re-exports it, paired with the
// rewrite in vercel.json that sends `/api/*` traffic here.
//
// Vercel's Lambda filesystem is read-only outside `/tmp`, and `/tmp` is
// neither shared across instances nor durable across cold starts. So unless
// RUNS_DB_PATH already points at `/tmp`, SQLite can't even open the file for
// writing. This makes the run history usable per-invocation for a demo, but
// NOT a durable production data store — each cold start reseeds from
// src/data/runs_history.json. For real persistence, swap in a hosted DB.
if (!process.env.RUNS_DB_PATH) {
  process.env.RUNS_DB_PATH = '/tmp/runs.db';
}

const { initDb } = await import('../database.ts');
const { app } = await import('../server.ts');

await initDb();

export default app;
