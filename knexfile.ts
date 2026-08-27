import type { Knex } from "knex";
import path from "path";

const config: Knex.Config = {
  client: "sqlite3",
  connection: {
    filename: path.join(process.cwd(), "data", "lotops.db"),
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