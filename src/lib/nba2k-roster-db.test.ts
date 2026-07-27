import { describe, expect, it, vi } from "vitest";
import type { DraftDbClient } from "./draft-db";
import {
  ensureNba2kRosterSchema,
  loadRosterPlayerMedia,
  loadRosterPlayerIdentities,
  loadNba2kRosterPlayers,
  normalizeNba2kRosterPlayer,
  parseNba2kRosterSourcePayload,
  updateRosterNbaPlayerIds,
  upsertNba2kRosterPlayers
} from "./nba2k-roster-db";

describe("NBA 2K roster persistence", () => {
  it("normalizes NBA2KLab players to local team ids and keeps attribute ratings", () => {
    const player = normalizeNba2kRosterPlayer({
      id: 42,
      first_name: "Kawhi",
      last_name: "Leonard",
      team: "Los Angeles Clippers",
      position: "SF",
      rating: 92,
      height: "6'7",
      weight: 225,
      wingspan: "7'3",
      age: 34,
      pot: "A",
      mid: 93,
      "3pt": 86,
      pdef: 92
    });

    expect(player).toEqual({
      gameVersion: "nba2k26",
      source: "nba2klab",
      sourcePlayerId: 42,
      teamId: "lac",
      teamName: "Los Angeles Clippers",
      firstName: "Kawhi",
      lastName: "Leonard",
      fullName: "Kawhi Leonard",
      position: "SF",
      rating: 92,
      height: "6'7",
      weight: 225,
      wingspan: "7'3",
      age: 34,
      potential: "A",
      attributes: {
        "3pt": 86,
        mid: 93,
        pdef: 92
      },
      sourceUrl: "https://www.nba2klab.com/.netlify/functions/player-roster"
    });
  });

  it("corrects known NBA2KLab player name misspellings", () => {
    const corrections = [
      ["Alperen", "Sengunun", "Alperen", "Şengün"],
      ["Daniel", "Gaffford", "Daniel", "Gafford"],
      ["Dario", "Whitehead", "Dariq", "Whitehead"],
      ["David", "Jones-Garcia", "David", "Jones Garcia"],
      ["Domantatas", "Sabonis", "Domantas", "Sabonis"],
      ["Luke", "Garza", "Luka", "Garza"],
      ["Stephon", "Curry", "Stephen", "Curry"],
      ["Terence", "Mann", "Terance", "Mann"],
      ["Tristen", "Da Silva", "Tristan", "da Silva"],
      ["Tristen", "Vukcevic", "Tristan", "Vukčević"],
      ["Zacchararie", "Risacher", "Zaccharie", "Risacher"],
      ["lvica", "Zubacac", "Ivica", "Zubac"]
    ] as const;

    for (const [
      firstName,
      lastName,
      expectedFirstName,
      expectedLastName
    ] of corrections) {
      const player = normalizeNba2kRosterPlayer({
        id: 999,
        first_name: firstName,
        last_name: lastName,
        team: "Philadelphia 76ers",
        rating: 80
      });

      expect({
        firstName: player.firstName,
        lastName: player.lastName,
        fullName: player.fullName
      }).toEqual({
        firstName: expectedFirstName,
        lastName: expectedLastName,
        fullName: `${expectedFirstName} ${expectedLastName}`
      });
    }
  });

  it("creates the NBA 2K roster table and lookup indexes", async () => {
    const db = createDbClient();

    await ensureNba2kRosterSchema(db);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS nba2k_roster_players")
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ADD COLUMN IF NOT EXISTS nba_player_id bigint")
    );
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("nba2k_roster_players_source_key")
    );
    expect(db.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("nba2k_roster_players_team_rating_idx")
    );
  });

  it("upserts normalized players as a jsonb batch", async () => {
    const db = createDbClient([[{ imported_players: 2 }]]);

    const result = await upsertNba2kRosterPlayers(db, [
      {
        id: 1,
        first_name: "Joel",
        last_name: "Embiid",
        team: "Philadelphia 76ers",
        position: "C",
        rating: 92,
        close: 96
      },
      {
        id: 2,
        first_name: "Jalen",
        last_name: "Brunson",
        team: "New York Knicks",
        position: "PG",
        rating: 93,
        ball: 95
      }
    ]);

    const [queryText, params] = vi.mocked(db.query).mock.calls[0];
    const payload = JSON.parse(params?.[0] as string);

    expect(result).toEqual({ importedPlayers: 2 });
    expect(queryText).toContain("jsonb_to_recordset($1::jsonb)");
    expect(queryText).toContain("ON CONFLICT (game_version, source, source_player_id)");
    expect(payload).toEqual([
      expect.objectContaining({
        sourcePlayerId: 1,
        teamId: "phi",
        fullName: "Joel Embiid",
        rating: 92,
        attributes: { close: 96 }
      }),
      expect.objectContaining({
        sourcePlayerId: 2,
        teamId: "nyk",
        fullName: "Jalen Brunson",
        rating: 93,
        attributes: { ball: 95 }
      })
    ]);
  });

  it("loads roster players for redraft sorted by rating and name", async () => {
    const db = createDbClient([
      [
        {
          source_player_id: 2,
          full_name: "Jalen Brunson",
          position: "PG",
          rating: 93,
          team_id: "nyk",
          team_name: "New York Knicks",
          nba_player_id: 1628973
        },
        {
          source_player_id: 1,
          full_name: "Joel Embiid",
          position: "C",
          rating: 92,
          team_id: "phi",
          team_name: "Philadelphia 76ers",
          nba_player_id: null
        }
      ]
    ]);

    const players = await loadNba2kRosterPlayers(db);
    const [queryText] = vi.mocked(db.query).mock.calls[0];

    expect(queryText).toContain("FROM nba2k_roster_players");
    expect(queryText).toContain("ORDER BY rating DESC, full_name ASC");
    expect(players.slice(0, 2)).toEqual([
      {
        sourcePlayerId: 2,
        nbaPlayerId: 1628973,
        fullName: "Jalen Brunson",
        position: "PG",
        rating: 93,
        teamId: "nyk",
        teamName: "New York Knicks"
      },
      {
        sourcePlayerId: 1,
        nbaPlayerId: null,
        fullName: "Joel Embiid",
        position: "C",
        rating: 92,
        teamId: "phi",
        teamName: "Philadelphia 76ers"
      }
    ]);
  });

  it("deduplicates known NBA roster aliases by canonical player name", async () => {
    const db = createDbClient([
      [
        {
          source_player_id: -9000063,
          full_name: "Alex Sarr",
          position: "C",
          rating: 84,
          team_id: "was",
          team_name: "Washington Wizards",
          nba_player_id: null
        },
        {
          source_player_id: 500,
          full_name: "Alexandre Sarr",
          position: "C | PF",
          rating: 81,
          team_id: "was",
          team_name: "Washington Wizards",
          nba_player_id: null
        },
        {
          source_player_id: -9000007,
          full_name: "Nic Claxton",
          position: "C",
          rating: 81,
          team_id: "chi",
          team_name: "Chicago Bulls",
          nba_player_id: null
        },
        {
          source_player_id: 278,
          full_name: "Nicolas Claxton",
          position: "C",
          rating: 79,
          team_id: "bkn",
          team_name: "Brooklyn Nets",
          nba_player_id: null
        },
        {
          source_player_id: -9000064,
          full_name: "Bub Carrington",
          position: "PG",
          rating: 78,
          team_id: "was",
          team_name: "Washington Wizards",
          nba_player_id: null
        },
        {
          source_player_id: 503,
          full_name: "Carlton Carrington",
          position: "PG",
          rating: 77,
          team_id: "was",
          team_name: "Washington Wizards",
          nba_player_id: null
        }
      ]
    ]);

    const players = await loadNba2kRosterPlayers(db);

    expect(
      players.filter((player) =>
        [
          "Alex Sarr",
          "Alexandre Sarr",
          "Bub Carrington",
          "Carlton Carrington",
          "Nic Claxton",
          "Nicolas Claxton"
        ].includes(player.fullName)
      )
    ).toEqual([
      expect.objectContaining({ sourcePlayerId: 500, fullName: "Alexandre Sarr" }),
      expect.objectContaining({ sourcePlayerId: 278, fullName: "Nicolas Claxton" }),
      expect.objectContaining({ sourcePlayerId: 503, fullName: "Carlton Carrington" })
    ]);
  });

  it("loads roster identities for NBA id matching", async () => {
    const db = createDbClient([
      [
        {
          source_player_id: 400,
          full_name: "Victor Wembanyama",
          nba_player_id: null
        }
      ]
    ]);

    await expect(loadRosterPlayerIdentities(db)).resolves.toEqual([
      {
        sourcePlayerId: 400,
        fullName: "Victor Wembanyama",
        nbaPlayerId: null
      }
    ]);
  });

  it("loads one roster player's NBA media id", async () => {
    const db = createDbClient([[{ nba_player_id: 1641705 }]]);

    await expect(loadRosterPlayerMedia(db, 400)).resolves.toEqual({
      nbaPlayerId: 1641705
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("source_player_id = $1"),
      [400]
    );
  });

  it("updates only matched NBA ids and preserves unmatched rows", async () => {
    const db = createDbClient([[{ updated_players: 1 }]]);
    const matches = [{ sourcePlayerId: 400, nbaPlayerId: 1641705 }];

    await expect(updateRosterNbaPlayerIds(db, matches)).resolves.toEqual({
      updatedPlayers: 1
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET nba_player_id = input.nba_player_id"),
      [JSON.stringify(matches)]
    );
  });

  it("adds the 2026 draft class to roster players and avoids duplicate names", async () => {
    const db = createDbClient([
      [
        {
          source_player_id: 1,
          full_name: "Nikola Jokic",
          position: "C",
          rating: 98,
          team_id: "den",
          team_name: "Denver Nuggets",
          nba_player_id: null
        },
        {
          source_player_id: 2,
          full_name: "AJ Dybantsa",
          position: "SF",
          rating: 83,
          team_id: "was",
          team_name: "Washington Wizards",
          nba_player_id: null
        }
      ]
    ]);

    const players = await loadNba2kRosterPlayers(db);
    const draftClassPlayers = players.filter(
      (player) => player.sourcePlayerId <= -2026001
    );

    expect(players[0]).toEqual({
      sourcePlayerId: 1,
      nbaPlayerId: null,
      fullName: "Nikola Jokic",
      position: "C",
      rating: 98,
      teamId: "den",
      teamName: "Denver Nuggets"
    });
    expect(players.filter((player) => player.fullName === "AJ Dybantsa")).toEqual([
      {
        sourcePlayerId: 2,
        nbaPlayerId: null,
        fullName: "AJ Dybantsa",
        position: "SF",
        rating: 83,
        teamId: "was",
        teamName: "Washington Wizards"
      }
    ]);
    expect(draftClassPlayers).toHaveLength(59);
    expect(players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fullName: "Darryn Peterson",
          position: "SG/PG",
          rating: 78,
          teamId: "uta"
        }),
        expect.objectContaining({
          fullName: "Cameron Boozer",
          position: "PF",
          rating: 77,
          teamId: "mem"
        }),
        expect.objectContaining({
          fullName: "Malique Lewis",
          position: "SF",
          rating: 67,
          teamId: "mil"
        })
      ])
    );
  });

  it("uses the official NBA spellings for the 2026 draft class", async () => {
    const players = await loadNba2kRosterPlayers(createDbClient([[]]));
    const playerNames = players.map((player) => player.fullName);

    expect(playerNames).toEqual(
      expect.arrayContaining([
        "Christian Anderson",
        "Karim López",
        "Sergio De Larrea"
      ])
    );
    expect(playerNames).not.toEqual(
      expect.arrayContaining([
        "Christian Anderson Jr.",
        "Karim Lopez",
        "Sergio de Larrea"
      ])
    );
  });

  it("avoids duplicate draft players when the roster omits accents", async () => {
    const db = createDbClient([
      [
        {
          source_player_id: 21,
          full_name: "Karim Lopez",
          position: "SF",
          rating: 74,
          team_id: "mem",
          team_name: "Memphis Grizzlies"
        }
      ]
    ]);

    const players = await loadNba2kRosterPlayers(db);
    const matchingPlayers = players.filter(
      (player) =>
        player.fullName === "Karim Lopez" || player.fullName === "Karim López"
    );

    expect(matchingPlayers).toEqual([
      expect.objectContaining({ sourcePlayerId: 21, fullName: "Karim Lopez" })
    ]);
  });

  it("accepts only array payloads from the roster source", () => {
    const payload = [{ id: 1, first_name: "Joel" }];

    expect(parseNba2kRosterSourcePayload(payload)).toBe(payload);
    expect(() => parseNba2kRosterSourcePayload({ data: payload })).toThrow(
      "NBA 2K roster source returned an invalid payload."
    );
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
