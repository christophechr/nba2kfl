export const PLAYER_SILHOUETTE_URL = "/images/player-silhouette.svg";

export const POSITION_FILTERS = ["all", "PG", "SG", "SF", "PF", "C"] as const;
export const POSITION_LABELS: Record<(typeof POSITION_FILTERS)[number], string> = {
  all: "Tous postes",
  PG: "Meneur (PG)",
  SG: "Arrière (SG)",
  SF: "Ailier (SF)",
  PF: "Ailier fort (PF)",
  C: "Pivot (C)"
};

const POSITION_COLOR_CLASSES: Record<string, string> = {
  PG: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  SG: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  SF: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  PF: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  C: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300"
};

export function formatCapHit(capHit: number | null | undefined) {
  if (capHit === null || capHit === undefined) {
    return null;
  }

  return `$${(capHit / 1_000_000).toFixed(1)}M`;
}

export function getPlayerPhotoUrl(nbaPlayerId: number | null) {
  return nbaPlayerId
    ? `/api/discord-media/player/${nbaPlayerId}`
    : PLAYER_SILHOUETTE_URL;
}

export function getRatingTileClasses(rating: number) {
  if (rating >= 90) {
    return "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white";
  }

  if (rating >= 80) {
    return "bg-gradient-to-br from-indigo-400 to-indigo-600 text-white";
  }

  if (rating >= 70) {
    return "bg-gradient-to-br from-amber-400 to-amber-600 text-white";
  }

  return "bg-gradient-to-br from-slate-400 to-slate-600 text-white";
}

export function getPrimaryPosition(position: string | null) {
  return position?.split(/[/|,]/)[0]?.trim().toUpperCase() ?? null;
}

export function getPositionChipClasses(position: string | null) {
  const primary = getPrimaryPosition(position);

  return primary ? (POSITION_COLOR_CLASSES[primary] ?? "") : "";
}

