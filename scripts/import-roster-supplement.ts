import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import type { DraftDbClient } from "../src/lib/draft-db.ts";
import {
  ensureNba2kRosterSchema,
  parseNba2kRosterSourcePayload,
  upsertNba2kRosterPlayers
} from "../src/lib/nba2k-roster-db.ts";

const DEFAULT_DATA_FILE = "scripts/data/nba2k-roster-supplement-2026-07-21.json";

type ImportOptions = {
  dryRun?: boolean;
  dataFile?: string;
};

export async function importRosterSupplement({
  dryRun = false,
  dataFile = DEFAULT_DATA_FILE
}: ImportOptions = {}) {
  const sourcePlayers = parseNba2kRosterSourcePayload(
    JSON.parse(readFileSync(dataFile, "utf8"))
  );

  if (dryRun) {
    return {
      dryRun,
      dataFile,
      fetchedPlayers: sourcePlayers.length,
      importedPlayers: 0
    };
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const db = createDbClient(pool);
    await ensureNba2kRosterSchema(db);
    const result = await upsertNba2kRosterPlayers(db, sourcePlayers);

    return {
      dryRun,
      dataFile,
      fetchedPlayers: sourcePlayers.length,
      importedPlayers: result.importedPlayers
    };
  } finally {
    await pool.end();
  }
}

function createDbClient(pool: Pool): DraftDbClient {
  return {
    async query(queryText, params) {
      const result = await pool.query(queryText, params);

      return result.rows;
    }
  };
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = unwrapQuotedValue(match[2].trim());
  }
}

function unwrapQuotedValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function main() {
  const dataFileArg = process.argv
    .find((arg) => arg.startsWith("--file="))
    ?.slice("--file=".length);

  const result = await importRosterSupplement({
    dryRun: process.argv.includes("--dry-run"),
    dataFile: dataFileArg
  });

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
