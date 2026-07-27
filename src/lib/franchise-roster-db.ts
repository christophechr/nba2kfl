import type { DraftDbClient } from "./draft-db";
import {
  findSeasonCapHit,
  loadPlayerContracts,
  normalizeNameForContractMatch
} from "./player-contracts-db";

export const REDRAFT_SALARY_CAP_LIMIT = 180_000_000;
const CONTRACT_DISPLAY_SEASON = 2026;

type FranchiseRosterRow = {
  pick_number: number | string;
  round: number | string;
  round_pick: number | string;
  player_name: string;
  nba_player_id: number | string | null;
  position: string | null;
  rating: number | string | null;
};

export type FranchiseRosterPlayer = {
  pickNumber: number;
  round: number;
  roundPick: number;
  fullName: string;
  nbaPlayerId: number | null;
  position: string | null;
  rating: number | null;
  contractCapHit2026: number | null;
};

export async function loadFranchiseRoster(
  db: DraftDbClient,
  teamId: string
): Promise<FranchiseRosterPlayer[]> {
  const [rows, contracts] = await Promise.all([
    db.query<FranchiseRosterRow>(
      `
        SELECT
          redraft.pick_number,
          redraft.round,
          redraft.round_pick,
          redraft.player_name,
          roster.nba_player_id,
          roster.position,
          roster.rating
        FROM redraft_picks AS redraft
        LEFT JOIN nba2k_roster_players AS roster
          ON roster.source_player_id = redraft.roster_source_player_id
          AND roster.game_version = 'nba2k26'
          AND roster.source = 'nba2klab'
        WHERE redraft.franchise_team_id = $1
        ORDER BY redraft.pick_number
      `,
      [teamId]
    ),
    loadPlayerContracts(db)
  ]);

  const capHitByName = new Map(
    contracts.map((contract) => [
      normalizeNameForContractMatch(contract.fullName),
      findSeasonCapHit(contract.seasons, CONTRACT_DISPLAY_SEASON)
    ])
  );

  const players = rows.map((row) => ({
    pickNumber: Number(row.pick_number),
    round: Number(row.round),
    roundPick: Number(row.round_pick),
    fullName: row.player_name,
    nbaPlayerId: row.nba_player_id === null ? null : Number(row.nba_player_id),
    position: row.position,
    rating: row.rating === null ? null : Number(row.rating),
    contractCapHit2026:
      capHitByName.get(normalizeNameForContractMatch(row.player_name)) ?? null
  }));

  return players.sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.fullName.localeCompare(b.fullName)
  );
}

export function calculateTotalCapHit(
  players: readonly Pick<FranchiseRosterPlayer, "contractCapHit2026">[]
) {
  return players.reduce(
    (total, player) => total + (player.contractCapHit2026 ?? 0),
    0
  );
}
