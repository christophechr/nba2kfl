import { NBA_TEAMS } from "../data/teams.ts";
import type { DraftDbClient } from "./draft-db";
import { normalizeRedraftPlayerIdentity } from "./redraft";

const GAME_VERSION = "nba2k26";
const SOURCE = "nba2klab";
export const NBA2KLAB_ROSTER_URL =
  "https://www.nba2klab.com/.netlify/functions/player-roster";

const PLAYER_NAME_CORRECTIONS = new Map<
  string,
  readonly [firstName: string, lastName: string]
>([
  ["Alperen Sengunun", ["Alperen", "Şengün"]],
  ["Daniel Gaffford", ["Daniel", "Gafford"]],
  ["Dario Whitehead", ["Dariq", "Whitehead"]],
  ["David Jones-Garcia", ["David", "Jones Garcia"]],
  ["Domantatas Sabonis", ["Domantas", "Sabonis"]],
  ["Luke Garza", ["Luka", "Garza"]],
  ["Stephon Curry", ["Stephen", "Curry"]],
  ["Terence Mann", ["Terance", "Mann"]],
  ["Tristen Da Silva", ["Tristan", "da Silva"]],
  ["Tristen Vukcevic", ["Tristan", "Vukčević"]],
  ["Zacchararie Risacher", ["Zaccharie", "Risacher"]],
  ["lvica Zubacac", ["Ivica", "Zubac"]]
]);

type Nba2kRosterSourcePlayer = Record<string, unknown>;

type Nba2kRosterAttribute = string | number | boolean | null;

export type Nba2kRosterPlayer = {
  gameVersion: string;
  source: string;
  sourcePlayerId: number;
  teamId: string;
  teamName: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  rating: number;
  height: string | null;
  weight: number | null;
  wingspan: string | null;
  age: number | null;
  potential: string | null;
  attributes: Record<string, Nba2kRosterAttribute>;
  sourceUrl: string;
};

export type Nba2kRosterPlayerSummary = {
  sourcePlayerId: number;
  nbaPlayerId: number | null;
  fullName: string;
  position: string | null;
  rating: number;
  teamId: string;
  teamName: string;
  contractCapHit2026?: number | null;
};

type Nba2kRosterPlayerSummaryRow = {
  source_player_id: number | string;
  nba_player_id: number | string | null;
  full_name: string;
  position: string | null;
  rating: number | string;
  team_id: string;
  team_name: string;
};
type RosterPlayerIdentityRow = {
  source_player_id: number | string;
  full_name: string;
  nba_player_id: number | string | null;
};
type UpdatedNbaPlayerRows = {
  updated_players: number | string;
};
type RosterPlayerMediaRow = {
  nba_player_id: number | string | null;
};

export type RosterPlayerIdentity = {
  sourcePlayerId: number;
  fullName: string;
  nbaPlayerId: number | null;
};
export type RosterNbaPlayerIdUpdate = {
  sourcePlayerId: number;
  nbaPlayerId: number;
};

export function parseNba2kRosterSourcePayload(
  payload: unknown
): Nba2kRosterSourcePlayer[] {
  if (!Array.isArray(payload)) {
    throw new Error("NBA 2K roster source returned an invalid payload.");
  }

  return payload as Nba2kRosterSourcePlayer[];
}

type ImportResultRow = {
  imported_players: number | string;
};

const SOURCE_FIELD_KEYS = new Set([
  "id",
  "first_name",
  "last_name",
  "team",
  "position",
  "rating",
  "overall_rating",
  "height",
  "weight",
  "wingspan",
  "age",
  "pot"
]);

const TEAM_IDS_BY_SOURCE_NAME = new Map(
  [
    ...NBA_TEAMS.map((team) => [normalizeName(team.name), team.id] as const),
    [normalizeName("Los Angeles Clippers"), "lac"] as const
  ]
);

export async function ensureNba2kRosterSchema(db: DraftDbClient) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nba2k_roster_players (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      game_version text NOT NULL,
      source text NOT NULL,
      source_player_id integer NOT NULL,
      team_id text NOT NULL,
      team_name text NOT NULL,
      first_name text NOT NULL,
      last_name text NOT NULL,
      full_name text NOT NULL,
      position text,
      rating integer NOT NULL,
      height text,
      weight integer,
      wingspan text,
      age integer,
      potential text,
      attributes jsonb NOT NULL,
      source_url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    ALTER TABLE nba2k_roster_players
    ADD COLUMN IF NOT EXISTS nba_player_id bigint
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS nba2k_roster_players_source_key
    ON nba2k_roster_players (game_version, source, source_player_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS nba2k_roster_players_team_rating_idx
    ON nba2k_roster_players (team_id, rating DESC, full_name)
  `);
}

export async function loadNba2kRosterPlayers(
  db: DraftDbClient
): Promise<Nba2kRosterPlayerSummary[]> {
  const rows = await db.query<Nba2kRosterPlayerSummaryRow>(`
    SELECT
      source_player_id,
      nba_player_id,
      full_name,
      position,
      rating,
      team_id,
      team_name
    FROM nba2k_roster_players
    ORDER BY rating DESC, full_name ASC
  `);

  const rosterPlayers = dedupeRosterPlayers(
    rows.map((row) => ({
      sourcePlayerId: Number(row.source_player_id),
      nbaPlayerId:
        row.nba_player_id === null || row.nba_player_id === undefined
          ? null
          : Number(row.nba_player_id),
      fullName: row.full_name,
      position: row.position,
      rating: Number(row.rating),
      teamId: row.team_id,
      teamName: row.team_name
    }))
  );

  const rosterNames = new Set(
    rosterPlayers.map((player) => normalizeRedraftPlayerIdentity(player.fullName))
  );
  const draftClassPlayers = NBA_DRAFT_CLASS_2026_ROOKIES.filter(
    (player) => !rosterNames.has(normalizeRedraftPlayerIdentity(player.fullName))
  );

  return [...rosterPlayers, ...draftClassPlayers].sort(compareRosterPlayers);
}

function dedupeRosterPlayers(players: Nba2kRosterPlayerSummary[]) {
  const playersByName = new Map<string, Nba2kRosterPlayerSummary>();

  for (const player of players) {
    const normalizedName = normalizeRedraftPlayerIdentity(player.fullName);
    const currentPlayer = playersByName.get(normalizedName);

    if (!currentPlayer || shouldReplaceRosterPlayer(currentPlayer, player)) {
      playersByName.set(normalizedName, player);
    }
  }

  return [...playersByName.values()];
}

function shouldReplaceRosterPlayer(
  currentPlayer: Nba2kRosterPlayerSummary,
  candidatePlayer: Nba2kRosterPlayerSummary
) {
  return (
    normalizeName(currentPlayer.fullName) !==
      normalizeRedraftPlayerIdentity(currentPlayer.fullName) &&
    normalizeName(candidatePlayer.fullName) ===
      normalizeRedraftPlayerIdentity(candidatePlayer.fullName)
  );
}

export async function loadRosterPlayerIdentities(
  db: DraftDbClient
): Promise<RosterPlayerIdentity[]> {
  const rows = await db.query<RosterPlayerIdentityRow>(`
    SELECT source_player_id, full_name, nba_player_id
    FROM nba2k_roster_players
    WHERE game_version = '${GAME_VERSION}'
      AND source = '${SOURCE}'
    ORDER BY source_player_id
  `);

  return rows.map((row) => ({
    sourcePlayerId: Number(row.source_player_id),
    fullName: row.full_name,
    nbaPlayerId:
      row.nba_player_id === null || row.nba_player_id === undefined
        ? null
        : Number(row.nba_player_id)
  }));
}

export async function loadRosterPlayerMedia(
  db: DraftDbClient,
  sourcePlayerId: number
) {
  const rows = await db.query<RosterPlayerMediaRow>(
    `
      SELECT nba_player_id
      FROM nba2k_roster_players
      WHERE game_version = '${GAME_VERSION}'
        AND source = '${SOURCE}'
        AND source_player_id = $1
      LIMIT 1
    `,
    [sourcePlayerId]
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    nbaPlayerId:
      row.nba_player_id === null ? null : Number(row.nba_player_id)
  };
}

export async function updateRosterNbaPlayerIds(
  db: DraftDbClient,
  updates: readonly RosterNbaPlayerIdUpdate[]
) {
  if (updates.length === 0) {
    return { updatedPlayers: 0 };
  }

  const rows = await db.query<UpdatedNbaPlayerRows>(
    `
      WITH input AS (
        SELECT
          "sourcePlayerId" AS source_player_id,
          "nbaPlayerId" AS nba_player_id
        FROM jsonb_to_recordset($1::jsonb) AS raw(
          "sourcePlayerId" integer,
          "nbaPlayerId" bigint
        )
      ),
      updated AS (
        UPDATE nba2k_roster_players AS roster
        SET nba_player_id = input.nba_player_id, updated_at = now()
        FROM input
        WHERE roster.game_version = '${GAME_VERSION}'
          AND roster.source = '${SOURCE}'
          AND roster.source_player_id = input.source_player_id
        RETURNING roster.source_player_id
      )
      SELECT count(*)::int AS updated_players
      FROM updated
    `,
    [JSON.stringify(updates)]
  );

  return {
    updatedPlayers: Number(rows[0]?.updated_players ?? 0)
  };
}

const NBA_DRAFT_CLASS_2026_ROOKIES: Nba2kRosterPlayerSummary[] = [
  draftClass2026Player(1, "AJ Dybantsa", "SF", 82, "was"),
  draftClass2026Player(2, "Darryn Peterson", "SG/PG", 78, "uta"),
  draftClass2026Player(3, "Cameron Boozer", "PF", 77, "mem"),
  draftClass2026Player(4, "Caleb Wilson", "SF/PF", 76, "chi"),
  draftClass2026Player(5, "Keaton Wagler", "SG/PG", 75, "lac"),
  draftClass2026Player(6, "Mikel Brown Jr.", "PG", 75, "bkn"),
  draftClass2026Player(7, "Darius Acuff Jr.", "PG", 75, "sac"),
  draftClass2026Player(8, "Kingston Flemings", "PG", 75, "atl"),
  draftClass2026Player(9, "Morez Johnson Jr.", "PF/C", 74, "dal"),
  draftClass2026Player(10, "Brayden Burries", "SG/PG", 74, "mil"),
  draftClass2026Player(11, "Yaxel Lendeborg", "PF", 74, "gsw"),
  draftClass2026Player(12, "Aday Mara", "C", 74, "okc"),
  draftClass2026Player(13, "Nate Ament", "SF", 74, "mil"),
  draftClass2026Player(14, "Hannes Steinbach", "PF", 74, "cha"),
  draftClass2026Player(15, "Dailyn Swain", "SG/SF", 73, "chi"),
  draftClass2026Player(16, "Bennett Stirtz", "PG", 73, "okc"),
  draftClass2026Player(17, "Ebuka Okorie", "PG", 73, "det"),
  draftClass2026Player(18, "Christian Anderson", "PG", 73, "cha"),
  draftClass2026Player(19, "Allen Graves", "PF", 73, "tor"),
  draftClass2026Player(20, "Jayden Quaintance", "PF/C", 73, "sas"),
  draftClass2026Player(21, "Karim López", "SF", 73, "mem"),
  draftClass2026Player(22, "Labaron Philon Jr.", "PG", 73, "phi"),
  draftClass2026Player(23, "Zuby Ejiofor", "PF", 72, "atl"),
  draftClass2026Player(24, "Cameron Carr", "SG", 72, "lal"),
  draftClass2026Player(25, "Sergio De Larrea", "PG/SG", 72, "dal"),
  draftClass2026Player(26, "Tarris Reed Jr.", "C", 72, "sas"),
  draftClass2026Player(27, "Chris Cenac Jr.", "PF/C", 72, "bos"),
  draftClass2026Player(28, "Joshua Jefferson", "PF/SF", 72, "bkn"),
  draftClass2026Player(29, "Alex Karaban", "SF/PF", 72, "sac"),
  draftClass2026Player(30, "Koa Peat", "PF", 72, "phx"),
  draftClass2026Player(31, "Bruce Thornton", "PG", 70, "hou"),
  draftClass2026Player(32, "Richie Saunders", "SG", 70, "mem"),
  draftClass2026Player(33, "Isaiah Evans", "SF", 70, "min"),
  draftClass2026Player(34, "Meleek Thomas", "SG/PG", 70, "cle"),
  draftClass2026Player(35, "Trevon Brazile", "PF", 70, "den"),
  draftClass2026Player(36, "Baba Miller", "SF", 70, "lac"),
  draftClass2026Player(37, "Ryan Conwell", "SG", 70, "mia"),
  draftClass2026Player(38, "Braden Smith", "PG", 70, "ind"),
  draftClass2026Player(39, "Jack Kayil", "PG", 70, "nyk"),
  draftClass2026Player(40, "Dillon Mitchell", "SF", 70, "bos"),
  draftClass2026Player(41, "Otega Oweh", "SG", 70, "okc"),
  draftClass2026Player(42, "Ja'Kobi Gillespie", "PG", 70, "sas"),
  draftClass2026Player(43, "Tyler Bilodeau", "PF", 70, "bkn"),
  draftClass2026Player(44, "Maliq Brown", "PF", 70, "sas"),
  draftClass2026Player(45, "Emanuel Sharp", "SG", 70, "sac"),
  draftClass2026Player(46, "Felix Okpara", "C", 67, "was"),
  draftClass2026Player(47, "Tyler Nickel", "SG", 67, "nyk"),
  draftClass2026Player(48, "Tobi Lawal", "PF", 67, "dal"),
  draftClass2026Player(49, "Bryce Hopkins", "SF", 67, "den"),
  draftClass2026Player(50, "Jaden Bradley", "PG", 67, "tor"),
  draftClass2026Player(51, "Izaiyah Nelson", "PF/C", 67, "orl"),
  draftClass2026Player(52, "Henri Veesaar", "C", 67, "atl"),
  draftClass2026Player(53, "Ugonna Onyenso", "C", 67, "det"),
  draftClass2026Player(54, "Lajae Jones", "SG", 67, "gsw"),
  draftClass2026Player(55, "Nick Martinelli", "SF", 67, "lac"),
  draftClass2026Player(56, "Vsevolod Ishchenko", "SF", 67, "dal"),
  draftClass2026Player(57, "Narcisse Ngoy", "C", 67, "lac"),
  draftClass2026Player(58, "Jaron Pierre Jr.", "SG", 67, "nop"),
  draftClass2026Player(59, "Trey Kaufman-Renn", "PF", 67, "min"),
  draftClass2026Player(60, "Malique Lewis", "SF", 67, "mil")
];

function draftClass2026Player(
  pickNumber: number,
  fullName: string,
  position: string,
  rating: number,
  teamId: string
): Nba2kRosterPlayerSummary {
  const team = NBA_TEAMS.find((candidate) => candidate.id === teamId);

  if (!team) {
    throw new Error(`Unknown NBA draft class team id: ${teamId}`);
  }

  return {
    sourcePlayerId: -2026000 - pickNumber,
    nbaPlayerId: null,
    fullName,
    position,
    rating,
    teamId,
    teamName: team.name
  };
}

function compareRosterPlayers(
  player: Nba2kRosterPlayerSummary,
  otherPlayer: Nba2kRosterPlayerSummary
) {
  if (player.rating !== otherPlayer.rating) {
    return otherPlayer.rating - player.rating;
  }

  return player.fullName.localeCompare(otherPlayer.fullName);
}

export function normalizeNba2kRosterPlayer(
  sourcePlayer: Nba2kRosterSourcePlayer
): Nba2kRosterPlayer {
  const sourcePlayerId = requiredInteger(sourcePlayer.id, "id");
  const sourceFirstName = requiredString(sourcePlayer.first_name, "first_name");
  const sourceLastName = requiredString(sourcePlayer.last_name, "last_name");
  const [firstName, lastName] = PLAYER_NAME_CORRECTIONS.get(
    `${sourceFirstName} ${sourceLastName}`
  ) ?? [sourceFirstName, sourceLastName];
  const teamName = requiredString(sourcePlayer.team, "team");
  const teamId = TEAM_IDS_BY_SOURCE_NAME.get(normalizeName(teamName));

  if (!teamId) {
    throw new Error(`Unknown NBA 2K roster team: ${teamName}`);
  }

  return {
    gameVersion: GAME_VERSION,
    source: SOURCE,
    sourcePlayerId,
    teamId,
    teamName,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    position: optionalString(sourcePlayer.position),
    rating: requiredInteger(
      sourcePlayer.rating ?? sourcePlayer.overall_rating,
      "rating"
    ),
    height: optionalString(sourcePlayer.height),
    weight: optionalInteger(sourcePlayer.weight),
    wingspan: optionalString(sourcePlayer.wingspan),
    age: optionalInteger(sourcePlayer.age),
    potential: optionalString(sourcePlayer.pot),
    attributes: extractAttributes(sourcePlayer),
    sourceUrl: NBA2KLAB_ROSTER_URL
  };
}

export async function upsertNba2kRosterPlayers(
  db: DraftDbClient,
  sourcePlayers: Nba2kRosterSourcePlayer[]
) {
  if (sourcePlayers.length === 0) {
    return { importedPlayers: 0 };
  }

  const players = sourcePlayers.map(normalizeNba2kRosterPlayer);
  const rows = await db.query<ImportResultRow>(
    `
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS x(
          "gameVersion" text,
          source text,
          "sourcePlayerId" integer,
          "teamId" text,
          "teamName" text,
          "firstName" text,
          "lastName" text,
          "fullName" text,
          position text,
          rating integer,
          height text,
          weight integer,
          wingspan text,
          age integer,
          potential text,
          attributes jsonb,
          "sourceUrl" text
        )
      ),
      upserted AS (
        INSERT INTO nba2k_roster_players (
          game_version,
          source,
          source_player_id,
          team_id,
          team_name,
          first_name,
          last_name,
          full_name,
          position,
          rating,
          height,
          weight,
          wingspan,
          age,
          potential,
          attributes,
          source_url,
          created_at,
          updated_at
        )
        SELECT
          "gameVersion",
          source,
          "sourcePlayerId",
          "teamId",
          "teamName",
          "firstName",
          "lastName",
          "fullName",
          position,
          rating,
          height,
          weight,
          wingspan,
          age,
          potential,
          attributes,
          "sourceUrl",
          now(),
          now()
        FROM input
        ON CONFLICT (game_version, source, source_player_id) DO UPDATE SET
          team_id = excluded.team_id,
          team_name = excluded.team_name,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          full_name = excluded.full_name,
          position = excluded.position,
          rating = excluded.rating,
          height = excluded.height,
          weight = excluded.weight,
          wingspan = excluded.wingspan,
          age = excluded.age,
          potential = excluded.potential,
          attributes = excluded.attributes,
          source_url = excluded.source_url,
          updated_at = now()
        RETURNING source_player_id
      )
      SELECT count(*)::int AS imported_players
      FROM upserted
    `,
    [JSON.stringify(players)]
  );

  return {
    importedPlayers: Number(rows[0]?.imported_players ?? 0)
  };
}

function extractAttributes(sourcePlayer: Nba2kRosterSourcePlayer) {
  const attributes: Record<string, Nba2kRosterAttribute> = {};

  for (const [key, value] of Object.entries(sourcePlayer)) {
    if (SOURCE_FIELD_KEYS.has(key) || !isAttributeValue(value)) {
      continue;
    }

    attributes[key] = value;
  }

  return attributes;
}

function isAttributeValue(value: unknown): value is Nba2kRosterAttribute {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`NBA 2K roster field "${fieldName}" is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  return null;
}

function requiredInteger(value: unknown, fieldName: string) {
  const integer = optionalInteger(value);

  if (integer === null) {
    throw new Error(`NBA 2K roster field "${fieldName}" must be an integer.`);
  }

  return integer;
}

function optionalInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
