CREATE TABLE IF NOT EXISTS checklist_templates (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    label          TEXT NOT NULL,
    sort_order     INTEGER NOT NULL DEFAULT 0
);
