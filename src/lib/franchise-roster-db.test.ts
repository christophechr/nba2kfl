import { describe, expect, it, vi } from "vitest";
import type { DraftDbClient } from "./draft-db";
import {
  calculateTotalCapHit,
  loadFranchiseRoster,
  REDRAFT_SALARY_CAP_LIMIT
} from "./franchise-roster-db";

describe("franchise roster persistence", () => {
  it("exposes the custom redraft salary cap limit", () => {
    expect(REDRAFT_SALARY_CAP_LIMIT).toBe(180_000_000);
  });

  it("loads a franchise's roster joined with ratings and cap hits, sorted by rating", async () => {
    const db = createDbClient([
      [
        {
          pick_number: 2,
          round: 1,
          round_pick: 2,
          player_name: "Jayson Tatum",
          nba_player_id: 1628369,
          position: "PF",
          rating: 93
        },
        {
          pick_number: 5,
          round: 1,
          round_pick: 5,
          player_name: "Some Unrated Guy",
          nba_player_id: null,
          position: null,
          rating: null
        }
      ],
      [
        {
          source_player_id: "23598",
          team_id: "bos",
          full_name: "Jayson Tatum",
          position: "PF",
          seasons: [{ season: 2026, age: 28, status: null, capHit: 58456566 }]
        }
      ]
    ]);

    const roster = await loadFranchiseRoster(db, "bos");

    expect(roster).toEqual([
      expect.objectContaining({
        fullName: "Jayson Tatum",
        rating: 93,
        contractCapHit2026: 58456566
      }),
      expect.objectContaining({
        fullName: "Some Unrated Guy",
        rating: null,
        contractCapHit2026: null
      })
    ]);

    const [queryText, params] = vi.mocked(db.query).mock.calls[0];
    expect(queryText).toContain("WHERE redraft.franchise_team_id = $1");
    expect(params).toEqual(["bos"]);
  });
});

describe("calculateTotalCapHit", () => {
  it("sums known cap hits and treats missing contracts as zero", () => {
    const total = calculateTotalCapHit([
      { contractCapHit2026: 58456566 },
      { contractCapHit2026: null },
      { contractCapHit2026: 2296274 }
    ]);

    expect(total).toBe(58456566 + 2296274);
  });
});

function createDbClient(results: Record<string, unknown>[][] = []): DraftDbClient {
  let callIndex = 0;
  const query = vi.fn(
    async <T extends Record<string, unknown> = Record<string, unknown>>(
      _queryText: string,
      _params?: unknown[]
    ) => (results[callIndex++] ?? []) as T[]
  );

  return {
    query: query as DraftDbClient["query"]
  };
}
