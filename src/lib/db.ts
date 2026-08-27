import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "lotops.db");

// Ensure the data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");

// Run pending migrations
function runMigrations() {
  // Ensure _migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(process.cwd(), "src", "lib", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const applied = new Set(
    db
      .prepare("SELECT migration_name FROM _migrations")
      .all()
      .map((r: any) => r.migration_name)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

    // Split on semicolons and execute each non-empty statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      db.exec(stmt);
    }

    db.prepare("INSERT INTO _migrations (migration_name) VALUES (?)").run(file);
    console.log(`Migration applied: ${file}`);
  }
}

runMigrations();

export default db;
