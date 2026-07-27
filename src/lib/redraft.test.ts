import { describe, expect, it } from "vitest";
import { NBA_TEAMS } from "@/data/teams";
import {
  createDraftSlots,
  createSnakeDraftPicks,
  DEFAULT_GM_DRAFT_ORDER,
  FINAL_FRANCHISE_SELECTIONS,
  GM_DRAFT_SLOT_LINKS,
  isRedraftPlayerSelected,
  parseFranchiseSelections,
  validateRedraftPickChange,
  type FranchiseSelection
} from "./redraft";

const selections: FranchiseSelection[] = [
  {
    slot: 1,
    gmName: "GM A",
    teamId: NBA_TEAMS[0].id
  },
  {
    slot: 2,
    gmName: "GM B",
    teamId: NBA_TEAMS[1].id
  },
  {
    slot: 3,
    gmName: "GM C",
    teamId: NBA_TEAMS[2].id
  }
];

const finalGmNames = [
  "Abda",
  "Akuma",
  "Anna",
  "ASL",
  "Adito",
  "Ashu",
  "Chris",
  "Clem",
  "Diane",
  "Elias",
  "Enzo",
  "Fabien",
  "Hadiya",
  "Khaladan",
  "Laiku",
  "Naoufel",
  "nicotuyaux",
  "Nicomunist",
  "Nortalis",
  "Paul",
  "Polo",
  "Roazhon",
  "Romback",
  "Singe",
  "Sparky",
  "Tamarlin",
  "Tidwa",
  "Thomas",
  "Tony"
];

describe("createDraftSlots", () => {
  it("links the 30 GM draft slots to the auth users", () => {
    expect(GM_DRAFT_SLOT_LINKS).toHaveLength(30);
    expect(new Set(GM_DRAFT_SLOT_LINKS.map((slot) => slot.userName))).toEqual(
      new Set(finalGmNames)
    );
    expect(
      new Set(GM_DRAFT_SLOT_LINKS.map((slot) => slot.userEmail))
    ).toHaveLength(29);
    expect(GM_DRAFT_SLOT_LINKS[2]).toMatchObject({
      gmName: "Hadiya",
      userName: "Hadiya",
      userEmail: "hadiya@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[3]).toMatchObject({
      gmName: "Clemppt",
      userName: "Clem",
      userEmail: "clem@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[5]).toMatchObject({
      gmName: "Ashu de Metal",
      userName: "Ashu",
      userEmail: "ashu@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[8]).toMatchObject({
      gmName: "Aditooo",
      userName: "Adito",
      userEmail: "adito@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[9]).toMatchObject({
      gmName: "Nicomunist 2e équipe",
      userName: "Nicomunist",
      userEmail: "nicomunist@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[16]).toMatchObject({
      gmName: "nicotuyaux",
      userName: "nicotuyaux",
      userEmail: "nicotuyaux@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[18]).toMatchObject({
      gmName: "Thomasninho",
      userName: "Thomas",
      userEmail: "thomas@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[21]).toMatchObject({
      gmName: "Nicomunist",
      userName: "Nicomunist",
      userEmail: "nicomunist@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[27]).toMatchObject({
      gmName: "Polodilintrepid",
      userName: "Polo",
      userEmail: "polo@nba2kfl.local"
    });
    expect(GM_DRAFT_SLOT_LINKS[28]).toMatchObject({
      gmName: "Diane",
      userName: "Diane",
      userEmail: "diane@nba2kfl.local"
    });
  });

  it("uses the configured NBA2KFL GM draft order by default", () => {
    const slots = createDraftSlots();

    expect(slots).toHaveLength(30);
    expect(slots.map((slot) => slot.gmName)).toEqual([
      "Anna",
      "Elias",
      "Hadiya",
      "Clemppt",
      "Roazhon",
      "Ashu de Metal",
      "Chris",
      "Akuma",
      "Aditooo",
      "Nicomunist 2e équipe",
      "Singe",
      "Paulrv97",
      "Enzo.",
      "Nortalis",
      "Abda",
      "Sparky",
      "nicotuyaux",
      "ASL",
      "Thomasninho",
      "Tony",
      "Tamarlin",
      "Nicomunist",
      "Tidwa",
      "Fabien",
      "Romback",
      "Naoufel",
      "Laiku",
      "Polodilintrepid",
      "Diane",
      "Khaladan"
    ]);
    expect(DEFAULT_GM_DRAFT_ORDER).toHaveLength(30);
  });

  it("stores the final franchise choices from the 2026 redraft", () => {
    expect(FINAL_FRANCHISE_SELECTIONS).toEqual([
      { slot: 1, teamId: "hou" },
      { slot: 2, teamId: "ind" },
      { slot: 3, teamId: "tor" },
      { slot: 4, teamId: "phi" },
      { slot: 5, teamId: "lal" },
      { slot: 6, teamId: "sac" },
      { slot: 7, teamId: "sas" },
      { slot: 8, teamId: "den" },
      { slot: 9, teamId: "det" },
      { slot: 10, teamId: "mil" },
      { slot: 11, teamId: "phx" },
      { slot: 12, teamId: "lac" },
      { slot: 13, teamId: "dal" },
      { slot: 14, teamId: "okc" },
      { slot: 15, teamId: "por" },
      { slot: 16, teamId: "min" },
      { slot: 17, teamId: "uta" },
      { slot: 18, teamId: "chi" },
      { slot: 19, teamId: "mia" },
      { slot: 20, teamId: "orl" },
      { slot: 21, teamId: "cha" },
      { slot: 22, teamId: "gsw" },
      { slot: 23, teamId: "was" },
      { slot: 24, teamId: "atl" },
      { slot: 25, teamId: "bkn" },
      { slot: 26, teamId: "nop" },
      { slot: 27, teamId: "bos" },
      { slot: 28, teamId: "mem" },
      { slot: 29, teamId: "nyk" },
      { slot: 30, teamId: "cle" }
    ]);
  });

  it("falls back to numbered names after the configured order", () => {
    const slots = createDraftSlots(31);

    expect(slots[30]).toEqual({ slot: 31, gmName: "GM 31", teamId: null });
  });
});

describe("createSnakeDraftPicks", () => {
  it("alternates between normal and reversed order each round", () => {
    const picks = createSnakeDraftPicks(selections, 3);

    expect(
      picks.map((pick) => ({
        pickNumber: pick.pickNumber,
        round: pick.round,
        roundPick: pick.roundPick,
        slot: pick.selection.slot,
        gmName: pick.selection.gmName
      }))
    ).toEqual([
      { pickNumber: 1, round: 1, roundPick: 1, slot: 1, gmName: "GM A" },
      { pickNumber: 2, round: 1, roundPick: 2, slot: 2, gmName: "GM B" },
      { pickNumber: 3, round: 1, roundPick: 3, slot: 3, gmName: "GM C" },
      { pickNumber: 4, round: 2, roundPick: 1, slot: 3, gmName: "GM C" },
      { pickNumber: 5, round: 2, roundPick: 2, slot: 2, gmName: "GM B" },
      { pickNumber: 6, round: 2, roundPick: 3, slot: 1, gmName: "GM A" },
      { pickNumber: 7, round: 3, roundPick: 1, slot: 1, gmName: "GM A" },
      { pickNumber: 8, round: 3, roundPick: 2, slot: 2, gmName: "GM B" },
      { pickNumber: 9, round: 3, roundPick: 3, slot: 3, gmName: "GM C" }
    ]);
  });

  it("ignores unassigned franchise slots", () => {
    const picks = createSnakeDraftPicks(
      [...selections, { slot: 4, gmName: "GM D", teamId: null }],
      2
    );

    expect(picks).toHaveLength(6);
    expect(picks.every((pick) => pick.selection.teamId)).toBe(true);
  });
});

describe("validateRedraftPickChange", () => {
  const draftPicks = createSnakeDraftPicks(selections, 2);
  const playerPool = ["Joueur 1", "Joueur 2", "Joueur 3"];

  it("accepts only valid current-pick player choices", () => {
    expect(
      validateRedraftPickChange({
        draftPicks,
        pickNumber: 1,
        picksByNumber: {},
        playerName: "Joueur 1",
        playerPool
      })
    ).toEqual({ valid: true, playerName: "Joueur 1" });

    expect(
      validateRedraftPickChange({
        draftPicks,
        pickNumber: 2,
        picksByNumber: {},
        playerName: "Joueur 2",
        playerPool
      })
    ).toEqual({ valid: false, message: "Valide d'abord le pick #1." });

    expect(
      validateRedraftPickChange({
        draftPicks,
        pickNumber: 2,
        picksByNumber: { 1: "Joueur 1" },
        playerName: "Joueur 1",
        playerPool
      })
    ).toEqual({ valid: false, message: "Ce joueur est deja pris." });

    expect(
      validateRedraftPickChange({
        draftPicks,
        pickNumber: 2,
        picksByNumber: { 1: "Joueur 1" },
        playerName: "Joueur inconnu",
        playerPool
      })
    ).toEqual({ valid: false, message: "Ce joueur n'est pas disponible." });
  });

  it("rejects already picked players by normalized alias for future picks", () => {
    const playerPoolWithAliases = [
      "Alex Sarr",
      "Bub Carrington",
      "De’Anthony Melton",
      "Nic Claxton",
      "Joueur 2"
    ];

    for (const playerName of [
      "Alex Sarr",
      "Bub Carrington",
      "De’Anthony Melton",
      "Nic Claxton"
    ]) {
      expect(
        validateRedraftPickChange({
          draftPicks,
          pickNumber: 5,
          picksByNumber: {
            1: "Alexandre Sarr",
            2: "Carlton Carrington",
            3: "De'Anthony Melton",
            4: "Nicolas Claxton"
          },
          playerName,
          playerPool: playerPoolWithAliases
        })
      ).toEqual({ valid: false, message: "Ce joueur est deja pris." });
    }
  });
});

describe("isRedraftPlayerSelected", () => {
  it("matches selected players by normalized aliases for available player lists", () => {
    const selectedPlayers = new Set([
      "Alexandre Sarr",
      "Carlton Carrington",
      "De'Anthony Melton",
      "Nicolas Claxton"
    ]);

    expect(isRedraftPlayerSelected("Alex Sarr", selectedPlayers)).toBe(true);
    expect(isRedraftPlayerSelected("Bub Carrington", selectedPlayers)).toBe(true);
    expect(isRedraftPlayerSelected("De’Anthony Melton", selectedPlayers)).toBe(true);
    expect(isRedraftPlayerSelected("Nic Claxton", selectedPlayers)).toBe(true);
    expect(isRedraftPlayerSelected("Joueur disponible", selectedPlayers)).toBe(false);
  });
});

describe("parseFranchiseSelections", () => {
  it("restores valid franchise team choices with locked GM names", () => {
    const restored = parseFranchiseSelections(
      JSON.stringify(selections),
      3,
      NBA_TEAMS.map((team) => team.id)
    );

    expect(restored).toEqual([
      { slot: 1, gmName: "Anna", teamId: NBA_TEAMS[0].id },
      { slot: 2, gmName: "Elias", teamId: NBA_TEAMS[1].id },
      { slot: 3, gmName: "Hadiya", teamId: NBA_TEAMS[2].id }
    ]);
  });

  it("locks restored GM names to the configured draft order", () => {
    const restored = parseFranchiseSelections(
      JSON.stringify([{ ...selections[0], gmName: "Nom modifié" }]),
      1,
      NBA_TEAMS.map((team) => team.id)
    );

    expect(restored?.[0]?.gmName).toBe("Anna");
  });

  it("rejects incomplete, duplicate, or unknown franchise selections", () => {
    const teamIds = NBA_TEAMS.map((team) => team.id);

    expect(
      parseFranchiseSelections(JSON.stringify(selections.slice(1)), 3, teamIds)
    ).toBeNull();
    expect(
      parseFranchiseSelections(
        JSON.stringify([
          selections[0],
          { ...selections[1], teamId: selections[0].teamId },
          selections[2]
        ]),
        3,
        teamIds
      )
    ).toBeNull();
    expect(
      parseFranchiseSelections(
        JSON.stringify([
          selections[0],
          { ...selections[1], teamId: "unknown" },
          selections[2]
        ]),
        3,
        teamIds
      )
    ).toBeNull();
  });
});
