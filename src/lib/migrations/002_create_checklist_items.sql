CREATE TABLE IF NOT EXISTS vehicle_checklist_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id     INTEGER NOT NULL REFERENCES vehicles(id),
    label          TEXT NOT NULL,
    done           INTEGER NOT NULL DEFAULT 0,
    done_at        TEXT,
    sort_order     INTEGER NOT NULL DEFAULT 0
);
