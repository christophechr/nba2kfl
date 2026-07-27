import { describe, expect, it } from "vitest";
import { filterRosterPlayers } from "./PlayerPickerDialog";
import type { Nba2kRosterPlayerSummary } from "@/lib/nba2k-roster-db";

const players: Nba2kRosterPlayerSummary[] = [
  {
    sourcePlayerId: 1,
    nbaPlayerId: null,
    fullName: "Nikola Jokic",
    position: "C",
    rating: 98,
    teamId: "den",
    teamName: "Denver Nuggets"
  },
  {
    sourcePlayerId: 2,
    nbaPlayerId: null,
    fullName: "Shai Gilgeous-Alexander",
    position: "PG",
    rating: 97,
    teamId: "okc",
    teamName: "Oklahoma City Thunder"
  },
  {
    sourcePlayerId: 3,
    nbaPlayerId: null,
    fullName: "LeBron James",
    position: "SF",
    rating: 94,
    teamId: "lal",
    teamName: "Los Angeles Lakers"
  }
];

describe("filterRosterPlayers", () => {
  it("excludes players already taken by other picks but keeps the current pick's own selection", () => {
    const result = filterRosterPlayers({
      players,
      position: "all",
      search: "",
      selectedPlayer: "Nikola Jokic",
      selectedPlayers: new Set(["Nikola Jokic", "LeBron James"])
    });

    expect(result.map((player) => player.fullName)).toEqual([
      "Nikola Jokic",
      "Shai Gilgeous-Alexander"
    ]);
  });

  it("excludes already taken aliases from the next pick's player list", () => {
    const result = filterRosterPlayers({
      players: [
        ...players,
        {
          sourcePlayerId: 4,
          nbaPlayerId: null,
          fullName: "Alex Sarr",
          position: "C",
          rating: 84,
          teamId: "was",
          teamName: "Washington Wizards"
        },
        {
          sourcePlayerId: 5,
          nbaPlayerId: null,
          fullName: "Bub Carrington",
          position: "PG",
          rating: 78,
          teamId: "was",
          teamName: "Washington Wizards"
        }
      ],
      position: "all",
      search: "",
      selectedPlayer: "",
      selectedPlayers: new Set(["Alexandre Sarr", "Carlton Carrington"])
    });

    expect(result.map((player) => player.fullName)).toEqual([
      "Nikola Jokic",
      "Shai Gilgeous-Alexander",
      "LeBron James"
    ]);
  });

  it("filters by case-insensitive name search", () => {
    const result = filterRosterPlayers({
      players,
      position: "all",
      search: "lebron",
      selectedPlayer: "",
      selectedPlayers: new Set()
    });

    expect(result.map((player) => player.fullName)).toEqual(["LeBron James"]);
  });

  it("filters by position", () => {
    const result = filterRosterPlayers({
      players,
      position: "PG",
      search: "",
      selectedPlayer: "",
      selectedPlayers: new Set()
    });

    expect(result.map((player) => player.fullName)).toEqual([
      "Shai Gilgeous-Alexander"
    ]);
  });

  it("sorts by rating descending", () => {
    const result = filterRosterPlayers({
      players,
      position: "all",
      search: "",
      selectedPlayer: "",
      selectedPlayers: new Set()
    });

    expect(result.map((player) => player.rating)).toEqual([98, 97, 94]);
  });
});
