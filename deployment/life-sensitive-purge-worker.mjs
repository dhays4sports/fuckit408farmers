/* 408-LIFE-1.8 — companion Cron Worker for hard short-lived-vault cleanup. */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS life_application_sensitive (
  request_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  revealed_at TEXT,
  reveal_actor TEXT,
  destroyed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_life_sensitive_status_expiry
  ON life_application_sensitive(status, expires_at);
CREATE TABLE IF NOT EXISTS life_application_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_email TEXT,
  from_status TEXT,
  to_status TEXT,
  created_at TEXT NOT NULL
);
`;

async function purge(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') throw new Error('LIFE_QUEUE_DB binding is required');
  await db.exec(SCHEMA_SQL);
  const now = new Date().toISOString();
  const result = await db.prepare(`
    SELECT request_id, status FROM life_application_sensitive
    WHERE status IN ('ready','revealed') AND expires_at <= ?1 LIMIT 500
  `).bind(now).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  for (const row of rows) {
    const update = await db.prepare(`
      UPDATE life_application_sensitive
      SET status = 'expired', ciphertext = '', iv = '', destroyed_at = ?1
      WHERE request_id = ?2 AND status IN ('ready','revealed')
    `).bind(now, row.request_id).run();
    const changes = Number(update && update.meta && update.meta.changes);
    if (!Number.isFinite(changes) || changes > 0) {
      await db.prepare(`
        INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
        VALUES (?1, 'sensitive_expired', NULL, ?2, 'expired', ?3)
      `).bind(row.request_id, row.status || '', now).run();
    }
  }
  return rows.length;
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(purge(env.LIFE_QUEUE_DB));
  }
};

export { purge };
