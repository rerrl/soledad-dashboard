CREATE TABLE IF NOT EXISTS vehicles (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vin            TEXT NOT NULL,
    stock_number   TEXT,
    make           TEXT NOT NULL,
    model          TEXT NOT NULL,
    year           INTEGER NOT NULL,
    color          TEXT,
    mileage        INTEGER,
    series         TEXT,
    total_cost     REAL,
    selling_price  REAL,
    internet_price REAL,
    status         TEXT NOT NULL DEFAULT 'incoming'
                   CHECK (status IN ('incoming', 'recon', 'parked', 'for_sale', 'not_for_sale', 'sold')),
    smog_done      INTEGER NOT NULL DEFAULT 0,
    detail_done    INTEGER NOT NULL DEFAULT 0,
    inspected_done INTEGER NOT NULL DEFAULT 0,
    last_fb_post   TEXT,
    reviewed_at    TEXT,
    imported_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
