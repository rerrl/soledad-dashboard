import type { Knex } from "knex";
import path from "path";
import fs from "fs";

// Ensure the data directory exists — knex opens the connection lazily on first
// query, but sqlite3 still needs the parent directory to exist.
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const config: Knex.Config = {
  client: "sqlite3",
  connection: {
    filename: path.join(dataDir, "lotops.db"),
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(process.cwd(), "src", "lib", "migrations"),
    extension: "ts",
  },
  seeds: {
    directory: path.join(process.cwd(), "scripts", "seeds"),
    extension: "ts",
  },
};

export default config;
