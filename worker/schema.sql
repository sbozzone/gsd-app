-- worker/schema.sql — D1 schema for gsd-db
-- Run with: wrangler d1 execute gsd-db --file=worker/schema.sql

-- ── PROJECTS ────────────────────────────────────────────────────────────────
-- Must be created before tasks (foreign key reference)
CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  bucket     TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── TASKS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  bucket     TEXT    NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  status     TEXT    NOT NULL DEFAULT 'backlog',  -- backlog | active | blocked | done
  horizon    TEXT    NOT NULL DEFAULT 'now',       -- now | next | later
  size       TEXT    NOT NULL DEFAULT 'M',         -- S | M | L
  is_mit     INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_bucket  ON tasks(bucket);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_horizon ON tasks(horizon);
CREATE INDEX IF NOT EXISTS idx_tasks_is_mit  ON tasks(is_mit);

-- ── IDEAS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  bucket     TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'idea',  -- idea | someday
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── INBOX ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  text         TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'manual',  -- manual | reminders
  reminders_id TEXT,                             -- Apple Reminders external ID for dedup
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_reminders_id ON inbox(reminders_id)
  WHERE reminders_id IS NOT NULL;
