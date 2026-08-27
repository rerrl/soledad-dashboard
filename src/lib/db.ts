import knex from "knex";
import path from "path";
import fs from "fs";
import config from "../../knexfile";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = knex(config);

// Enable WAL mode for better concurrent access
db.raw("PRAGMA journal_mode = WAL").then(() => {
  // noop — WAL memory pragma runs on connection init
});

export default db;