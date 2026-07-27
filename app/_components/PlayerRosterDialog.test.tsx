import { describe, expect, it } from "vitest";
import { filterRosterByStatus } from "./PlayerRosterDialog";
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

describe("filterRosterByStatus", () => {
  it("shows only players not yet selected when filtering on available", () => {
    const result = filterRosterByStatus({
      players,
      position: "all",
      search: "",
      selectedPlayers: new Set(["Nikola Jokic"]),
      status: "available"
    });

    expect(result.map((player) => player.fullName)).toEqual([
      "Shai Gilgeous-Alexander",
      "LeBron James"
    ]);
  });

  it("hides selected aliases when filtering on available players", () => {
    const result = filterRosterByStatus({
      players: [
        ...players,
        {
          sourcePlayerId: 4,
          nbaPlayerId: null,
          fullName: "Nic Claxton",
          position: "C",
          rating: 81,
          teamId: "chi",
          teamName: "Chicago Bulls"
        },
        {
          sourcePlayerId: 5,
          nbaPlayerId: null,
          fullName: "De’Anthony Melton",
          position: "SG",
          rating: 78,
          teamId: "gsw",
          teamName: "Golden State Warriors"
        }
      ],
      position: "all",
      search: "",
      selectedPlayers: new Set(["Nicolas Claxton", "De'Anthony Melton"]),
      status: "available"
    });

    expect(result.map((player) => player.fullName)).toEqual([
      "Nikola Jokic",
      "Shai Gilgeous-Alexander",
      "LeBron James"
    ]);
  });

  it("shows only already selected players when filtering on taken", () => {
    const result = filterRosterByStatus({
      players,
      position: "all",
      search: "",
      selectedPlayers: new Set(["Nikola Jokic"]),
      status: "taken"
    });

    expect(result.map((player) => player.fullName)).toEqual(["Nikola Jokic"]);
  });

  it("combines status with search and position filters", () => {
    const result = filterRosterByStatus({
      players,
      position: "SF",
      search: "lebron",
      selectedPlayers: new Set(),
      status: "available"
    });

    expect(result.map((player) => player.fullName)).toEqual(["LeBron James"]);
  });
});
