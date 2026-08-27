CREATE TABLE IF NOT EXISTS import_log (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    imported_at       TEXT NOT NULL DEFAULT (datetime('now')),
    vehicles_added   INTEGER NOT NULL DEFAULT 0,
    vehicles_removed INTEGER NOT NULL DEFAULT 0,
    prices_changed   INTEGER NOT NULL DEFAULT 0,
    details          TEXT
);
