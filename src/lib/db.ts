import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "lotops.db");

// Ensure the data directory exists
import fs from "fs";
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");

export default db;