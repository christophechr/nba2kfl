export type FranchiseSelection = {
  slot: number;
  gmName: string;
  teamId: string | null;
};

export type AssignedFranchiseSelection = FranchiseSelection & {
  teamId: string;
};

export type SnakeDraftPick = {
  pickNumber: number;
  round: number;
  roundPick: number;
  selection: AssignedFranchiseSelection;
};

export type RedraftPicksByNumber = Record<string, string>;

export type RedraftPickValidationResult =
  | { valid: true; playerName: string }
  | { valid: false; message: string };

export type GmDraftSlotLink = {
  slot: number;
  gmName: string;
  userName: string;
  userEmail: string;
};

export type FinalFranchiseSelection = {
  slot: number;
  teamId: string;
};

const REDRAFT_PLAYER_NAME_ALIASES = new Map<string, string>([
  ["alex sarr", "alexandre sarr"],
  ["bub carrington", "carlton carrington"],
  ["nic claxton", "nicolas claxton"]
]);

export const REDRAFT_PLAYER_POOL_STORAGE_KEY = "nba2kfl:redraft-player-pool:v1";
export const REDRAFT_PICKS_STORAGE_KEY = "nba2kfl:redraft-picks:v1";

export const GM_DRAFT_SLOT_LINKS = [
  createGmDraftSlotLink(1, "Anna", "Anna"),
  createGmDraftSlotLink(2, "Elias", "Elias"),
  createGmDraftSlotLink(3, "Hadiya", "Hadiya"),
  createGmDraftSlotLink(4, "Clemppt", "Clem"),
  createGmDraftSlotLink(5, "Roazhon", "Roazhon"),
  createGmDraftSlotLink(6, "Ashu de Metal", "Ashu"),
  createGmDraftSlotLink(7, "Chris", "Chris"),
  createGmDraftSlotLink(8, "Akuma", "Akuma"),
  createGmDraftSlotLink(9, "Aditooo", "Adito"),
  createGmDraftSlotLink(10, "Nicomunist 2e équipe", "Nicomunist"),
  createGmDraftSlotLink(11, "Singe", "Singe"),
  createGmDraftSlotLink(12, "Paulrv97", "Paul"),
  createGmDraftSlotLink(13, "Enzo.", "Enzo"),
  createGmDraftSlotLink(14, "Nortalis", "Nortalis"),
  createGmDraftSlotLink(15, "Abda", "Abda"),
  createGmDraftSlotLink(16, "Sparky", "Sparky"),
  createGmDraftSlotLink(17, "nicotuyaux", "nicotuyaux"),
  createGmDraftSlotLink(18, "ASL", "ASL"),
  createGmDraftSlotLink(19, "Thomasninho", "Thomas"),
  createGmDraftSlotLink(20, "Tony", "Tony"),
  createGmDraftSlotLink(21, "Tamarlin", "Tamarlin"),
  createGmDraftSlotLink(22, "Nicomunist", "Nicomunist"),
  createGmDraftSlotLink(23, "Tidwa", "Tidwa"),
  createGmDraftSlotLink(24, "Fabien", "Fabien"),
  createGmDraftSlotLink(25, "Romback", "Romback"),
  createGmDraftSlotLink(26, "Naoufel", "Naoufel"),
  createGmDraftSlotLink(27, "Laiku", "Laiku"),
  createGmDraftSlotLink(28, "Polodilintrepid", "Polo"),
  createGmDraftSlotLink(29, "Diane", "Diane"),
  createGmDraftSlotLink(30, "Khaladan", "Khaladan")
] as const satisfies readonly GmDraftSlotLink[];

export const FINAL_FRANCHISE_SELECTIONS = [
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
] as const satisfies readonly FinalFranchiseSelection[];

export const DEFAULT_GM_DRAFT_ORDER = GM_DRAFT_SLOT_LINKS.map(
  (slot) => slot.gmName
);

export function createDraftSlots(
  count: number = DEFAULT_GM_DRAFT_ORDER.length
): FranchiseSelection[] {
  return Array.from({ length: count }, (_, index) => ({
    slot: index + 1,
    gmName: DEFAULT_GM_DRAFT_ORDER[index] ?? `GM ${index + 1}`,
    teamId: null
  }));
}

export function createSnakeDraftPicks(
  selections: readonly FranchiseSelection[],
  rounds: number
): SnakeDraftPick[] {
  if (!Number.isInteger(rounds) || rounds < 1) {
    return [];
  }

  const assignedSelections = selections
    .filter(isAssignedSelection)
    .toSorted((first, second) => first.slot - second.slot);

  return Array.from({ length: rounds }).flatMap((_, roundIndex) => {
    const round = roundIndex + 1;
    const roundSelections =
      round % 2 === 0 ? [...assignedSelections].reverse() : assignedSelections;

    return roundSelections.map((selection, index) => ({
      pickNumber: roundIndex * assignedSelections.length + index + 1,
      round,
      roundPick: index + 1,
      selection
    }));
  });
}

export function validateRedraftPickChange({
  draftPicks,
  pickNumber,
  picksByNumber,
  playerName,
  playerPool
}: {
  draftPicks: readonly SnakeDraftPick[];
  pickNumber: number;
  picksByNumber: RedraftPicksByNumber;
  playerName: string;
  playerPool: readonly string[];
}): RedraftPickValidationResult {
  const normalizedPlayerName = playerName.trim();
  const pickExists = draftPicks.some((pick) => pick.pickNumber === pickNumber);

  if (!pickExists) {
    return { valid: false, message: "Pick introuvable." };
  }

  if (!normalizedPlayerName) {
    return { valid: true, playerName: "" };
  }

  if (!playerPool.includes(normalizedPlayerName)) {
    return { valid: false, message: "Ce joueur n'est pas disponible." };
  }

  const normalizedPlayerIdentity = normalizeRedraftPlayerIdentity(
    normalizedPlayerName
  );
  const duplicatePick = Object.entries(picksByNumber).find(
    ([storedPickNumber, storedPlayerName]) =>
      Number(storedPickNumber) !== pickNumber &&
      normalizeRedraftPlayerIdentity(storedPlayerName) === normalizedPlayerIdentity
  );

  if (duplicatePick) {
    return { valid: false, message: "Ce joueur est deja pris." };
  }

  const currentPick = draftPicks.find(
    (pick) => !picksByNumber[pick.pickNumber]
  );

  if (
    currentPick &&
    !picksByNumber[pickNumber] &&
    currentPick.pickNumber !== pickNumber
  ) {
    return {
      valid: false,
      message: `Valide d'abord le pick #${currentPick.pickNumber}.`
    };
  }

  return { valid: true, playerName: normalizedPlayerName };
}

export function normalizeRedraftPlayerIdentity(value: string) {
  const normalizedName = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return REDRAFT_PLAYER_NAME_ALIASES.get(normalizedName) ?? normalizedName;
}

export function isRedraftPlayerSelected(
  playerName: string,
  selectedPlayers: ReadonlySet<string>
) {
  const playerIdentity = normalizeRedraftPlayerIdentity(playerName);

  return [...selectedPlayers].some(
    (selectedPlayer) =>
      normalizeRedraftPlayerIdentity(selectedPlayer) === playerIdentity
  );
}

export function parseFranchiseSelections(
  storedValue: string | null,
  slotCount: number,
  validTeamIds: readonly string[]
): FranchiseSelection[] | null {
  if (!storedValue) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(storedValue);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== slotCount) {
    return null;
  }

  const validTeamIdSet = new Set(validTeamIds);
  const selectedTeamIds = new Set<string>();
  const slots = new Set<number>();
  const selections: FranchiseSelection[] = [];

  for (const value of parsed) {
    if (!isSelectionShape(value)) {
      return null;
    }

    if (value.slot < 1 || value.slot > slotCount || slots.has(value.slot)) {
      return null;
    }

    if (value.teamId) {
      if (!validTeamIdSet.has(value.teamId) || selectedTeamIds.has(value.teamId)) {
        return null;
      }

      selectedTeamIds.add(value.teamId);
    }

    slots.add(value.slot);
    selections.push({
      slot: value.slot,
      gmName: getLockedGmName(value.slot),
      teamId: value.teamId
    });
  }

  return selections.toSorted((first, second) => first.slot - second.slot);
}

function isAssignedSelection(
  selection: FranchiseSelection
): selection is AssignedFranchiseSelection {
  return Boolean(selection.teamId);
}

function getLockedGmName(slot: number) {
  return DEFAULT_GM_DRAFT_ORDER[slot - 1] ?? `GM ${slot}`;
}

function isSelectionShape(value: unknown): value is FranchiseSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Number.isInteger(candidate.slot) &&
    typeof candidate.gmName === "string" &&
    (typeof candidate.teamId === "string" || candidate.teamId === null)
  );
}

function createGmDraftSlotLink(
  slot: number,
  gmName: string,
  userName: string
): GmDraftSlotLink {
  return {
    slot,
    gmName,
    userName,
    userEmail: `${slugifyUserName(userName)}@nba2kfl.local`
  };
}

function slugifyUserName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
