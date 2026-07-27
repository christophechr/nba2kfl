import { Star, Users, Wallet } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTeamAccentColor } from "@/data/team-colors";
import { NBA_TEAMS } from "@/data/teams";
import { auth } from "@/lib/auth";
import { getDraftDbClient, type DraftDbClient } from "@/lib/draft-db";
import {
  ensureFranchiseSelectionSchema,
  loadFranchiseOwnership
} from "@/lib/franchise-db";
import {
  calculateTotalCapHit,
  loadFranchiseRoster,
  REDRAFT_SALARY_CAP_LIMIT,
  type FranchiseRosterPlayer
} from "@/lib/franchise-roster-db";
import { ensureNba2kRosterSchema } from "@/lib/nba2k-roster-db";
import { ensurePlayerContractSchema } from "@/lib/player-contracts-db";
import { ensureRedraftPickSchema } from "@/lib/redraft-picks";
import { cn } from "@/lib/utils";
import { AppHeader } from "../../../_components/AppHeader";
import { PlayerAvatar } from "../../../_components/player-avatar";
import {
  formatCapHit,
  getPositionChipClasses,
  getRatingTileClasses
} from "../../../_components/player-visuals";

type FranchiseDashboardPageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function FranchiseDashboardPage({
  params
}: FranchiseDashboardPageProps) {
  const { teamId } = await params;
  const team = NBA_TEAMS.find((candidate) => candidate.id === teamId);

  if (!team) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) {
    redirect(`/sign-in?callbackURL=/draft/franchises/${teamId}`);
  }

  const db = getDraftDbClient();
  await prepareDb(db);

  const [ownershipState, roster] = await Promise.all([
    loadFranchiseOwnership(db, [teamId]),
    loadFranchiseRoster(db, teamId)
  ]);
  const ownership = ownershipState.franchises[0] ?? null;
  const totalCapHit = calculateTotalCapHit(roster);
  const capUsageRatio = Math.min(totalCapHit / REDRAFT_SALARY_CAP_LIMIT, 1);
  const isOverCap = totalCapHit > REDRAFT_SALARY_CAP_LIMIT;
  const capRemaining = REDRAFT_SALARY_CAP_LIMIT - totalCapHit;
  const accentColor = getTeamAccentColor(team.id);

  const ratedPlayers = roster.filter(
    (player): player is FranchiseRosterPlayer & { rating: number } =>
      player.rating !== null
  );
  const averageRating = ratedPlayers.length
    ? Math.round(
        ratedPlayers.reduce((total, player) => total + player.rating, 0) /
          ratedPlayers.length
      )
    : null;
  const topPlayer = roster[0] ?? null;

  return (
    <>
      <AppHeader
        activeHref="/draft/franchises"
        description={`Effectif et masse salariale de ${team.name}.`}
        eyebrow="NBA2KFL Franchise"
        title={team.name}
      />

      <section aria-label={`Dashboard ${team.name}`} className="mt-4 grid gap-4">
        <Link
          className="w-fit text-[0.82rem] font-[650] text-command-muted-strong hover:text-command-ink"
          href="/draft/franchises"
        >
          ← Retour aux franchises
        </Link>

        <div className="grid gap-4">
          <div
            className="relative overflow-hidden rounded-[20px] border border-command-border bg-command-surface p-5"
            style={{
              backgroundImage: `radial-gradient(560px circle at 0% 0%, ${hexToRgba(accentColor, 0.16)}, transparent 65%)`
            }}
          >
            <div className="relative flex items-center gap-4">
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-[16px] border bg-command-surface-muted p-2"
                style={{
                  borderColor: hexToRgba(accentColor, 0.4),
                  boxShadow: `0 10px 26px ${hexToRgba(accentColor, 0.22)}`
                }}
              >
                <img
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                  src={team.logoUrl}
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-[1.3rem] font-[800] tracking-[-0.02em] text-command-ink">
                  {team.name}
                </h2>
                <span
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-command-border bg-command-surface-muted px-2.5 py-1 text-[0.74rem] font-[650] text-command-muted-strong"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  {ownership?.owner
                    ? `GM · ${ownership.owner.displayName}`
                    : "Sans propriétaire"}
                </span>
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-command-border pt-4 max-[520px]:grid-cols-1">
              <div className="flex items-center gap-2.5 rounded-[12px] bg-command-surface-muted px-3 py-2.5">
                <Users className="h-4 w-4 shrink-0 text-command-muted" />
                <div className="min-w-0">
                  <p className="text-[0.98rem] font-[800] leading-none text-command-ink">
                    {roster.length}
                  </p>
                  <p className="mt-1 text-[0.66rem] font-[650] uppercase tracking-[0.06em] text-command-muted">
                    Joueur{roster.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-[12px] bg-command-surface-muted px-3 py-2.5">
                <Star className="h-4 w-4 shrink-0 text-command-muted" />
                <div className="min-w-0">
                  <p className="text-[0.98rem] font-[800] leading-none text-command-ink">
                    {averageRating ?? "—"}
                  </p>
                  <p className="mt-1 text-[0.66rem] font-[650] uppercase tracking-[0.06em] text-command-muted">
                    Rating moyen
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2.5 rounded-[12px] bg-command-surface-muted px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <Star className="h-2.5 w-2.5 fill-current" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.98rem] font-[800] leading-none text-command-ink">
                    {topPlayer ? topPlayer.fullName : "—"}
                  </p>
                  <p className="mt-1 truncate text-[0.66rem] font-[650] uppercase tracking-[0.06em] text-command-muted">
                    Meilleur joueur
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-[20px] border border-command-border bg-command-surface p-5"
            style={{
              backgroundImage: `radial-gradient(640px circle at 100% 0%, ${hexToRgba(accentColor, 0.1)}, transparent 60%)`
            }}
          >
            <div className="relative flex items-center gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
                style={{ backgroundColor: hexToRgba(accentColor, 0.14) }}
              >
                <Wallet className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <p className="text-[0.72rem] font-[760] uppercase tracking-[0.08em] text-command-muted">
                  Masse salariale 2026-27
                </p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <strong
                    className={cn(
                      "text-[1.6rem] font-[800] tabular-nums tracking-[-0.02em]",
                      isOverCap ? "text-command-warning-text" : "text-command-ink"
                    )}
                  >
                    {formatCapHit(totalCapHit) ?? "$0"}
                  </strong>
                  <span className="text-[0.82rem] font-[600] tabular-nums text-command-muted-strong">
                    / {formatCapHit(REDRAFT_SALARY_CAP_LIMIT)}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-4">
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-command-surface-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    isOverCap
                      ? "bg-command-warning-text"
                      : capUsageRatio > 0.85
                        ? "bg-amber-500"
                        : undefined
                  )}
                  style={{
                    backgroundImage:
                      !isOverCap && capUsageRatio <= 0.85
                        ? `linear-gradient(90deg, ${hexToRgba(accentColor, 0.6)}, ${accentColor})`
                        : undefined,
                    width: `${Math.round(capUsageRatio * 100)}%`
                  }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.78rem] font-[600] text-command-muted-strong">
                  {Math.round((totalCapHit / REDRAFT_SALARY_CAP_LIMIT) * 100)}% du plafond
                </span>
                <span
                  className={cn(
                    "text-[0.78rem] font-[650]",
                    isOverCap ? "text-command-warning-text" : "text-command-green-dark"
                  )}
                >
                  {isOverCap
                    ? `Dépassement de ${formatCapHit(Math.abs(capRemaining))}`
                    : `Espace restant : ${formatCapHit(capRemaining)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-command-border bg-command-surface p-5">
          <div className="mb-3.5 flex items-baseline justify-between gap-2">
            <h3 className="text-[1rem] font-[760] text-command-ink">Effectif</h3>
            <span className="text-[0.78rem] font-[600] text-command-muted-strong">
              {roster.length} joueur{roster.length > 1 ? "s" : ""}
            </span>
          </div>

          {roster.length === 0 ? (
            <p className="py-6 text-center text-[0.86rem] text-command-muted-strong">
              Aucun joueur draftée pour cette franchise pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1">
              {roster.map((player, index) => (
                <RosterCard
                  accentColor={accentColor}
                  isTopPlayer={index === 0}
                  key={player.pickNumber}
                  player={player}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function RosterCard({
  accentColor,
  isTopPlayer,
  player
}: {
  accentColor: string;
  isTopPlayer: boolean;
  player: FranchiseRosterPlayer;
}) {
  return (
    <div className="group flex items-stretch overflow-hidden rounded-[14px] border border-command-border bg-command-surface transition duration-150 ease-out hover:-translate-y-0.5 hover:border-command-border-strong hover:shadow-[0_10px_24px_rgba(16,24,40,0.1)]">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3">
        <div className="relative shrink-0">
          <PlayerAvatar className="h-11 w-11" nbaPlayerId={player.nbaPlayerId} />
          {isTopPlayer && player.rating !== null ? (
            <span
              aria-label="Meilleur joueur"
              className="absolute -right-1 -top-1 grid h-4.5 w-4.5 place-items-center rounded-full text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
              style={{ backgroundColor: accentColor }}
            >
              <Star className="h-2.5 w-2.5 fill-current" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem] font-[720] text-command-ink">
            {player.fullName}
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border border-command-border bg-command-surface-muted px-2 py-0.5 text-[0.62rem] font-[760] uppercase leading-none tracking-[0.08em] text-command-muted-strong",
                getPositionChipClasses(player.position)
              )}
            >
              {player.position ?? "?"}
            </span>
            {formatCapHit(player.contractCapHit2026) ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-command-green-soft px-2 py-0.5 text-[0.62rem] font-[760] uppercase leading-none tracking-[0.08em] text-command-green-dark">
                {formatCapHit(player.contractCapHit2026)}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-command-border bg-command-surface-muted px-2 py-0.5 text-[0.62rem] font-[760] uppercase leading-none tracking-[0.08em] text-command-muted-strong">
                UFA
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "grid w-14 shrink-0 place-items-center text-[1.05rem] font-[800] tracking-[-0.01em]",
          getRatingTileClasses(player.rating ?? 0)
        )}
      >
        {player.rating ?? "?"}
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function prepareDb(db: DraftDbClient) {
  await Promise.all([
    ensureFranchiseSelectionSchema(db),
    ensureRedraftPickSchema(db),
    ensureNba2kRosterSchema(db),
    ensurePlayerContractSchema(db)
  ]);
}
