CREATE TABLE IF NOT EXISTS sales (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vin            TEXT NOT NULL,
    stock_number   TEXT,
    make           TEXT,
    model          TEXT,
    year           INTEGER,
    sold_price     REAL,
    total_cost     REAL,
    sold_date      TEXT,
    buyer_name     TEXT,
    imported_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
