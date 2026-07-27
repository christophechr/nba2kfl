"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import { NBA_TEAMS, type Team } from "@/data/teams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./player-avatar";
import { PlayerPickerDialog } from "./PlayerPickerDialog";
import { PlayerRosterDialog } from "./PlayerRosterDialog";
import {
  formatCapHit,
  getPositionChipClasses,
  getPrimaryPosition,
  getRatingTileClasses
} from "./player-visuals";
import { useDraftLive } from "./useDraftLive";
import type { Nba2kRosterPlayerSummary } from "@/lib/nba2k-roster-db";
import {
  createSnakeDraftPicks,
  GM_DRAFT_SLOT_LINKS,
  validateRedraftPickChange,
  type FranchiseSelection,
  type RedraftPicksByNumber,
  type SnakeDraftPick
} from "@/lib/redraft";

export const MAX_REDRAFT_ROUNDS = 14;
const REDRAFT_ROUNDS = Array.from(
  { length: MAX_REDRAFT_ROUNDS },
  (_, index) => index + 1
);

type FranchiseSelectionsApiResponse = {
  selections?: FranchiseSelection[];
  error?: string;
};
type PlayersApiResponse = {
  players?: Nba2kRosterPlayerSummary[];
  error?: string;
};
type RedraftPicksApiResponse = {
  picks?: RedraftPicksByNumber;
  error?: string;
};
type RedraftRecapApiResponse = {
  pickCount?: number;
  messageCount?: number;
  error?: string;
};
type RedraftPickNotificationPayload = {
  gmName: string;
  pickNumber: number;
  playerName: string;
  playerSourceId: number;
  round: number;
  roundPick: number;
  teamName: string | null;
  teamId: string;
};
type RedraftRoomProps = {
  currentUserEmail: string | null;
  isAdmin?: boolean;
};

const USER_EMAILS_BY_DRAFT_SLOT = new Map(
  GM_DRAFT_SLOT_LINKS.map((link) => [link.slot, link.userEmail.toLowerCase()])
);

export function RedraftRoom({ currentUserEmail, isAdmin = false }: RedraftRoomProps) {
  const [selections, setSelections] = useState<FranchiseSelection[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<Nba2kRosterPlayerSummary[]>(
    []
  );
  const [picksByNumber, setPicksByNumber] = useState<RedraftPicksByNumber>({});
  const [openPickNumber, setOpenPickNumber] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [isRosterDialogOpen, setIsRosterDialogOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pickValidationError, setPickValidationError] = useState<string | null>(
    null
  );
  const [selectionLoadError, setSelectionLoadError] = useState<string | null>(
    null
  );
  const [playerLoadError, setPlayerLoadError] = useState<string | null>(null);
  const [isSendingRecap, startRecapTransition] = useTransition();
  const [recapStatus, setRecapStatus] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  const refreshRedraftState = useCallback(async () => {
    const [selectionResult, picksResult] = await Promise.allSettled([
      requestFranchiseSelections(),
      requestRedraftPicks()
    ]);

    if (selectionResult.status === "fulfilled") {
      setSelections(selectionResult.value);
      setSelectionLoadError(null);
    } else {
      setSelectionLoadError(toErrorMessage(selectionResult.reason));
    }

    if (picksResult.status === "fulfilled") {
      setPicksByNumber(picksResult.value);
      setPickValidationError(null);
    } else {
      setPickValidationError(toErrorMessage(picksResult.reason));
    }
  }, []);

  useDraftLive({ onRefresh: refreshRedraftState });

  useEffect(() => {
    let isMounted = true;

    async function restoreDraftState() {
      const [selectionResult, playerResult, picksResult] = await Promise.allSettled([
        requestFranchiseSelections(),
        requestRosterPlayers(),
        requestRedraftPicks()
      ]);

      if (!isMounted) {
        return;
      }

      if (selectionResult.status === "fulfilled") {
        setSelections(selectionResult.value);
        setSelectionLoadError(null);
      } else {
        setSelections([]);
        setSelectionLoadError(toErrorMessage(selectionResult.reason));
      }

      if (playerResult.status === "fulfilled") {
        setRosterPlayers(playerResult.value);
        setPlayerLoadError(null);
      } else {
        setRosterPlayers([]);
        setPlayerLoadError(toErrorMessage(playerResult.reason));
      }

      if (picksResult.status === "fulfilled") {
        setPicksByNumber(picksResult.value);
        setPickValidationError(null);
      } else {
        setPicksByNumber({});
        setPickValidationError(toErrorMessage(picksResult.reason));
      }

      setHasLoaded(true);
    }

    restoreDraftState();

    return () => {
      isMounted = false;
    };
  }, []);

  const draftPicks = useMemo(
    () => createSnakeDraftPicks(selections, MAX_REDRAFT_ROUNDS),
    [selections]
  );
  const playerPool = useMemo(
    () => rosterPlayers.map((player) => player.fullName),
    [rosterPlayers]
  );
  const selectedPlayers = useMemo(
    () => new Set(Object.values(picksByNumber).filter(Boolean)),
    [picksByNumber]
  );
  const completedPicks = draftPicks.filter(
    (pick) => picksByNumber[pick.pickNumber]
  ).length;
  const currentPick = draftPicks.find((pick) => !picksByNumber[pick.pickNumber]);
  const displayedRound =
    selectedRound ?? currentPick?.round ?? draftPicks.at(-1)?.round ?? 1;
  const displayedRoundPicks = useMemo(
    () => draftPicks.filter((pick) => pick.round === displayedRound),
    [draftPicks, displayedRound]
  );
  const playerStatusText = getPlayerStatusText({
    hasLoaded,
    playerCount: rosterPlayers.length,
    playerLoadError
  });

  async function updatePick(pickNumber: number, playerName: string) {
    const pick = draftPicks.find((draftPick) => draftPick.pickNumber === pickNumber);

    if (
      !pick ||
      !canCurrentUserSelectRedraftPick(
        pick,
        currentPick,
        currentUserEmail,
        isAdmin
      )
    ) {
      return;
    }

    const validation = validateRedraftPickChange({
      draftPicks,
      pickNumber,
      picksByNumber,
      playerName,
      playerPool
    });

    if (!validation.valid) {
      setPickValidationError(validation.message);
      return;
    }

    setPickValidationError(null);
    try {
      setPicksByNumber(
        await requestRedraftPickUpdate(pickNumber, validation.playerName)
      );

      if (validation.playerName) {
        const team = findTeam(pick.selection.teamId);
        const player = rosterPlayers.find(
          (candidate) => candidate.fullName === validation.playerName
        );

        if (player) {
          void notifyRedraftPickValidated({
            gmName: pick.selection.gmName,
            pickNumber: pick.pickNumber,
            playerName: validation.playerName,
            playerSourceId: player.sourcePlayerId,
            round: pick.round,
            roundPick: pick.roundPick,
            teamId: pick.selection.teamId,
            teamName: team?.name ?? null
          }).catch((error) => {
            console.error("Redraft Discord notification failed", error);
          });
        }
      }
    } catch (error) {
      setPickValidationError(toErrorMessage(error));
    }
  }

  async function clearPicks() {
    setPickValidationError(null);
    try {
      setPicksByNumber(await requestClearRedraftPicks());
    } catch (error) {
      setPickValidationError(toErrorMessage(error));
    }
  }

  function sendRedraftRecap() {
    setRecapStatus(null);
    startRecapTransition(async () => {
      try {
        const result = await requestRedraftRecap();

        setRecapStatus({
          kind: "success",
          message: `Récap Discord envoyé · ${result.pickCount} picks`
        });
      } catch (error) {
        setRecapStatus({
          kind: "error",
          message: toErrorMessage(error)
        });
      }
    });
  }

  return (
    <section
      aria-labelledby="redraft-title"
      className="min-w-0 overflow-hidden rounded-[18px] border border-command-border bg-command-surface shadow-[0_18px_48px_rgba(16,24,40,0.08)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_232px] items-start gap-6 border-b border-command-border bg-command-surface p-5 max-[1040px]:grid-cols-1 max-[620px]:p-4">
        <div>
          <p className="mb-1 text-[0.64rem] font-[760] leading-none uppercase tracking-[0.14em] text-command-muted">
            Redraft joueurs
          </p>
          <h2
            className="mb-2 text-[1.33rem] font-[730] leading-[1.08] tracking-[-0.045em] text-command-ink max-[620px]:text-[1.18rem]"
            id="redraft-title"
          >
            Draft snake NBA2KFL
          </h2>
          <p className="mb-0 max-w-[720px] text-[0.9rem] leading-[1.56] text-command-muted-strong max-[620px]:text-[0.88rem]">
            Le tour 1 suit l'ordre des franchises, le tour 2 repart en sens
            inverse, puis l'alternance continue.
          </p>
        </div>

        <div
          aria-label="Actions redraft"
          className="grid w-full gap-2 max-[1040px]:grid-cols-3 max-[620px]:grid-cols-1"
        >
          <Button onClick={clearPicks} variant="secondary">
            {isAdmin ? "Vider tous les picks" : "Vider mes picks"}
          </Button>
          {isAdmin ? (
            <Button
              disabled={isSendingRecap}
              onClick={sendRedraftRecap}
              variant="secondary"
            >
              {isSendingRecap ? "Envoi du récap…" : "Envoyer le récap Discord"}
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/draft/franchises">Franchises</Link>
          </Button>
          {recapStatus ? (
            <p
              aria-live="polite"
              className={cn(
                "col-span-full m-0 text-[0.78rem] font-[650] leading-[1.4]",
                recapStatus.kind === "error"
                  ? "text-command-red-text"
                  : "text-command-muted-strong"
              )}
              role={recapStatus.kind === "error" ? "alert" : "status"}
            >
              {recapStatus.message}
            </p>
          ) : null}
        </div>
      </div>

      <div
        aria-label="Résumé redraft"
        className="grid grid-cols-4 border-b border-command-border bg-command-surface-muted/55 max-[1040px]:grid-cols-2 max-[620px]:grid-cols-1"
      >
        <div className="min-h-[64px] border-r border-command-border px-4 py-3 max-[1040px]:border-b max-[1040px]:border-command-border max-[620px]:border-r-0">
          <span className="mb-1.5 block text-[0.64rem] font-[760] leading-none uppercase tracking-[0.13em] text-command-muted">
            Franchises
          </span>
          <strong className="text-[0.94rem] font-[720] leading-tight tracking-[-0.02em] text-command-ink">
            {selections.filter((selection) => selection.teamId).length}
          </strong>
        </div>
        <div className="min-h-[64px] border-r border-command-border px-4 py-3 max-[1040px]:border-r-0 max-[1040px]:border-b max-[1040px]:border-command-border">
          <span className="mb-1.5 block text-[0.64rem] font-[760] leading-none uppercase tracking-[0.13em] text-command-muted">
            Tours
          </span>
          <strong className="text-[0.94rem] font-[720] leading-tight tracking-[-0.02em] text-command-ink">
            {MAX_REDRAFT_ROUNDS}
          </strong>
        </div>
        <div className="min-h-[64px] border-r border-command-border px-4 py-3 max-[620px]:border-r-0 max-[620px]:border-b max-[620px]:border-command-border">
          <span className="mb-1.5 block text-[0.64rem] font-[760] leading-none uppercase tracking-[0.13em] text-command-muted">
            Picks
          </span>
          <strong className="text-[0.94rem] font-[720] leading-tight tracking-[-0.02em] text-command-ink">
            {completedPicks}/{draftPicks.length}
          </strong>
        </div>
        <div className="min-h-[64px] px-4 py-3">
          <span className="mb-1.5 block text-[0.64rem] font-[760] leading-none uppercase tracking-[0.13em] text-command-muted">
            Sur le clock
          </span>
          <strong className="text-[0.94rem] font-[720] leading-tight tracking-[-0.02em] text-command-ink">
            {currentPick ? formatSelection(currentPick) : "Terminé"}
          </strong>
        </div>
      </div>

      {pickValidationError ? (
        <div
          className="border-b border-command-red-border bg-command-red-soft px-4 py-3 text-[0.86rem] font-[650] text-command-red-text"
          role="alert"
        >
          {pickValidationError}
        </div>
      ) : null}

      {!hasLoaded ? (
        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-0 max-[1040px]:grid-cols-1">
          <div className="grid content-start gap-3.5 border-r border-command-border bg-command-surface-muted/45 p-4 max-[1040px]:border-r-0 max-[1040px]:border-b max-[1040px]:border-command-border">
            <Skeleton className="h-[38px] w-full rounded-[10px]" />
            <Skeleton className="h-24 w-full rounded-[10px]" />
          </div>
          <div className="grid gap-2.5 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton className="h-[60px] w-full rounded-[10px]" key={index} />
            ))}
          </div>
        </div>
      ) : draftPicks.length === 0 ? (
        <div
          className="grid min-h-[300px] content-center justify-items-center gap-2.5 p-8 text-center"
          role={selectionLoadError ? "alert" : undefined}
        >
          <strong className="text-[1.04rem] font-[740] tracking-[-0.025em] text-command-ink">
            {selectionLoadError
              ? "Franchises indisponibles"
              : "Aucune franchise attribuée"}
          </strong>
          <p className="m-0 max-w-[470px] leading-[1.56] text-command-muted-strong">
            {selectionLoadError ??
              "Enregistre au moins une franchise sur la page Franchises pour ouvrir la redraft."}
          </p>
          <Button asChild className="min-w-[220px] px-4">
            <Link href="/draft/franchises">Choisir les franchises</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-0 max-[1040px]:grid-cols-1">
          <aside
            aria-label="Configuration redraft"
            className="grid content-start gap-3.5 border-r border-command-border bg-command-surface-muted/45 p-4 max-[1040px]:border-r-0 max-[1040px]:border-b max-[1040px]:border-command-border"
          >
            <label className="grid gap-2">
              <span className="text-[0.64rem] font-[760] leading-none uppercase tracking-[0.13em] text-command-muted">
                Tour affiché
              </span>
              <Select
                onValueChange={(value) => setSelectedRound(Number(value))}
                value={String(displayedRound)}
              >
                <SelectTrigger aria-label="Choisir le tour affiché">
                  <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-left">
                    <span className="truncate">Tour {displayedRound}</span>
                    {currentPick?.round === displayedRound ? (
                      <Badge variant="success">En cours</Badge>
                    ) : null}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {REDRAFT_ROUNDS.map((roundNumber) => (
                    <SelectItem key={roundNumber} value={String(roundNumber)}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">Tour {roundNumber}</span>
                        {currentPick?.round === roundNumber ? (
                          <Badge variant="success">En cours</Badge>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div
              className="grid gap-1.5 rounded-[10px] border border-command-border bg-command-surface p-3"
              role={
                playerStatusText.isAlert ? "alert" : undefined
              }
            >
              <span className="text-[0.64rem] font-[760] leading-none uppercase tracking-[0.13em] text-command-muted">
                Joueurs DB
              </span>
              <strong className="text-[0.92rem] font-[720] tracking-[-0.02em] text-command-ink">
                {playerStatusText.title}
              </strong>
              <p className="m-0 text-[0.8rem] leading-[1.45] text-command-muted-strong">
                {playerStatusText.description}
              </p>
            </div>

            <Button onClick={() => setIsRosterDialogOpen(true)} variant="secondary">
              Voir la liste des joueurs
            </Button>
          </aside>

          <ol className="m-0 grid list-none p-0">
            {displayedRoundPicks.map((pick) => (
              <RedraftPickRow
                currentPickNumber={currentPick?.pickNumber ?? null}
                key={pick.pickNumber}
                isPlayerPickerOpen={openPickNumber === pick.pickNumber}
                isUserAllowedToEdit={canCurrentUserSelectRedraftPick(
                  pick,
                  currentPick,
                  currentUserEmail,
                  isAdmin
                )}
                onChange={updatePick}
                onOpenChange={(isOpen) =>
                  setOpenPickNumber((currentPickNumber) =>
                    isOpen
                      ? pick.pickNumber
                      : currentPickNumber === pick.pickNumber
                        ? null
                        : currentPickNumber
                  )
                }
                pick={pick}
                players={rosterPlayers}
                selectedPlayer={picksByNumber[pick.pickNumber] ?? ""}
                selectedPlayers={selectedPlayers}
              />
            ))}
          </ol>
        </div>
      )}

      <PlayerRosterDialog
        onOpenChange={setIsRosterDialogOpen}
        open={isRosterDialogOpen}
        players={rosterPlayers}
        selectedPlayers={selectedPlayers}
      />
    </section>
  );
}

function RedraftPickRow({
  currentPickNumber,
  isPlayerPickerOpen,
  isUserAllowedToEdit,
  onChange,
  onOpenChange,
  pick,
  players,
  selectedPlayer,
  selectedPlayers
}: {
  currentPickNumber: number | null;
  isPlayerPickerOpen: boolean;
  isUserAllowedToEdit: boolean;
  onChange: (pickNumber: number, playerName: string) => void;
  onOpenChange: (isOpen: boolean) => void;
  pick: SnakeDraftPick;
  players: Nba2kRosterPlayerSummary[];
  selectedPlayer: string;
  selectedPlayers: Set<string>;
}) {
  const team = findTeam(pick.selection.teamId);
  const isCurrent = currentPickNumber === pick.pickNumber;
  const selectedPlayerData = selectedPlayer
    ? players.find((player) => player.fullName === selectedPlayer)
    : undefined;
  const isPickLocked =
    !isUserAllowedToEdit || (players.length === 0 && !selectedPlayer);

  return (
    <li
      className={cn(
        "grid min-h-[60px] grid-cols-[78px_minmax(220px,1fr)_minmax(220px,320px)] items-center gap-3 border-b border-command-border px-3.5 py-2.5 first:border-t-0 max-[620px]:grid-cols-[60px_minmax(0,1fr)]",
        isCurrent
          ? "bg-command-accent-soft shadow-[inset_3px_0_0_var(--color-command-accent)]"
          : "odd:bg-command-surface-muted/45 hover:bg-command-accent-soft/65"
      )}
    >
      <div className="grid gap-0.5">
        <strong className="text-[0.98rem] font-[760] text-command-accent-dark">
          #{pick.pickNumber}
        </strong>
        <span className="text-[0.72rem] font-[650] text-command-muted">
          T{pick.round}.{pick.roundPick}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        {team ? <TeamLogo team={team} /> : null}
        <div className="min-w-0">
          <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.89rem] font-[700] text-command-ink">
            {pick.selection.gmName}
          </strong>
          {team ? (
            <Link
              className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[0.76rem] font-[650] text-command-muted hover:text-command-accent-dark hover:underline"
              href={`/draft/franchises/${team.id}`}
            >
              {team.name}
            </Link>
          ) : (
            <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[0.76rem] font-[650] text-command-muted">
              Franchise
            </span>
          )}
        </div>
      </div>

      <button
        aria-label={`Joueur du pick ${pick.pickNumber}`}
        className={cn(
          "flex min-h-[45px] w-full items-center gap-2 overflow-hidden rounded-[10px] border border-command-border bg-command-surface text-[0.86rem] text-command-text shadow-[0_1px_0_rgba(16,24,40,0.03)] transition duration-150 ease-out hover:border-command-border-strong focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(94,106,210,0.22)] disabled:cursor-not-allowed disabled:bg-command-surface-muted disabled:text-command-muted max-[620px]:col-span-full",
          selectedPlayerData ? "pl-1.5 pr-2.5" : "px-3"
        )}
        disabled={isPickLocked}
        onClick={() => onOpenChange(true)}
        type="button"
      >
        {selectedPlayerData ? (
          <>
            <PlayerAvatar className="h-7 w-7" nbaPlayerId={selectedPlayerData.nbaPlayerId} />
            <span className="flex min-w-0 flex-1 flex-col overflow-hidden text-left leading-tight">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap font-[650] text-command-ink">
                {selectedPlayerData.fullName}
              </span>
              <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[0.68rem] font-[600] text-command-muted">
                {formatCapHit(selectedPlayerData.contractCapHit2026)
                  ? `${formatCapHit(selectedPlayerData.contractCapHit2026)} (26-27)`
                  : "UFA"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "inline-flex w-7 shrink-0 items-center justify-center rounded-[6px] border py-0.5 text-[0.64rem] font-[760] uppercase",
                  getPositionChipClasses(selectedPlayerData.position)
                )}
              >
                {getPrimaryPosition(selectedPlayerData.position) ?? "?"}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-[6px] px-1.5 py-0.5 text-[0.72rem] font-[800]",
                  getRatingTileClasses(selectedPlayerData.rating)
                )}
              >
                {selectedPlayerData.rating}
              </span>
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
            {selectedPlayer
              ? selectedPlayer
              : isUserAllowedToEdit
                ? "Choisir joueur"
                : "Pas à votre tour"}
          </span>
        )}
        {isPickLocked || selectedPlayerData ? null : (
          <ChevronRight aria-hidden className="shrink-0 text-command-muted" size={14} />
        )}
      </button>

      <PlayerPickerDialog
        isUserAllowedToEdit={isUserAllowedToEdit}
        onConfirm={(playerName) => onChange(pick.pickNumber, playerName)}
        onOpenChange={onOpenChange}
        open={isPlayerPickerOpen}
        pick={pick}
        players={players}
        selectedPlayer={selectedPlayer}
        selectedPlayers={selectedPlayers}
        teamName={team?.name ?? null}
      />
    </li>
  );
}

function findTeam(teamId: string | null) {
  return NBA_TEAMS.find((team) => team.id === teamId) ?? null;
}

function formatSelection(pick: SnakeDraftPick) {
  const team = findTeam(pick.selection.teamId);

  return team
    ? `#${pick.pickNumber} ${team.abbreviation}`
    : `#${pick.pickNumber}`;
}

function getPlayerStatusText({
  hasLoaded,
  playerCount,
  playerLoadError
}: {
  hasLoaded: boolean;
  playerCount: number;
  playerLoadError: string | null;
}) {
  if (!hasLoaded) {
    return {
      description: "Chargement depuis la table NBA 2K.",
      isAlert: false,
      title: "Chargement"
    };
  }

  if (playerLoadError) {
    return {
      description: playerLoadError,
      isAlert: true,
      title: "Indisponibles"
    };
  }

  if (playerCount === 0) {
    return {
      description: "Aucun joueur importé dans la table NBA 2K.",
      isAlert: true,
      title: "0 joueurs"
    };
  }

  return {
    description: "Options chargées depuis la table NBA 2K.",
    isAlert: false,
    title: `${playerCount} joueurs`
  };
}

export function canCurrentUserEditRedraftPick(
  pick: SnakeDraftPick,
  currentUserEmail: string | null,
  isAdmin: boolean = false
) {
  if (isAdmin) {
    return true;
  }

  const allowedEmail = USER_EMAILS_BY_DRAFT_SLOT.get(pick.selection.slot);

  return (
    Boolean(allowedEmail) &&
    currentUserEmail?.trim().toLowerCase() === allowedEmail
  );
}

export function canCurrentUserSelectRedraftPick(
  pick: SnakeDraftPick,
  currentPick: SnakeDraftPick | null | undefined,
  currentUserEmail: string | null,
  isAdmin: boolean = false
) {
  return (
    currentPick?.pickNumber === pick.pickNumber &&
    canCurrentUserEditRedraftPick(pick, currentUserEmail, isAdmin)
  );
}

export function clearCurrentUserRedraftPicks(
  picksByNumber: RedraftPicksByNumber,
  draftPicks: readonly SnakeDraftPick[],
  currentUserEmail: string | null
) {
  const editablePickNumbers = new Set(
    draftPicks
      .filter((pick) => canCurrentUserEditRedraftPick(pick, currentUserEmail))
      .map((pick) => String(pick.pickNumber))
  );
  const nextPicks = { ...picksByNumber };

  for (const pickNumber of editablePickNumbers) {
    delete nextPicks[pickNumber];
  }

  return nextPicks;
}

export async function notifyRedraftPickValidated(
  payload: RedraftPickNotificationPayload
) {
  const response = await fetch("/api/redraft-picks/notifications", {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Impossible de notifier Discord.");
  }
}

function TeamLogo({ team }: { team: Team }) {
  return (
    <img
      alt=""
      className="h-[28px] w-[28px] shrink-0 object-contain"
      loading="lazy"
      src={team.logoUrl}
    />
  );
}

async function requestFranchiseSelections() {
  const response = await fetch("/api/franchise-selections");
  const payload = (await response
    .json()
    .catch(() => ({}))) as FranchiseSelectionsApiResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Impossible de charger les franchises.");
  }

  if (!Array.isArray(payload.selections)) {
    throw new Error("Reponse franchises invalide.");
  }

  return payload.selections;
}

async function requestRosterPlayers() {
  const response = await fetch("/api/players");
  const payload = (await response.json().catch(() => ({}))) as PlayersApiResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Impossible de charger les joueurs.");
  }

  if (!Array.isArray(payload.players)) {
    throw new Error("Reponse joueurs invalide.");
  }

  return payload.players;
}

export async function requestRedraftPicks() {
  const response = await fetch("/api/redraft-picks");
  const payload = (await response
    .json()
    .catch(() => ({}))) as RedraftPicksApiResponse;

  return parseRedraftPicksResponse(response, payload);
}

export async function requestRedraftPickUpdate(
  pickNumber: number,
  playerName: string
) {
  const response = await fetch("/api/redraft-picks", {
    body: JSON.stringify({ pickNumber, playerName }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as RedraftPicksApiResponse;

  return parseRedraftPicksResponse(response, payload);
}

export async function requestRedraftRecap() {
  const response = await fetch("/api/redraft-picks/notifications/recap", {
    method: "POST"
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as RedraftRecapApiResponse;

  if (!response.ok) {
    throw new Error(
      payload.error ?? "Impossible d'envoyer le récap Discord."
    );
  }

  if (
    typeof payload.pickCount !== "number" ||
    typeof payload.messageCount !== "number"
  ) {
    throw new Error("Réponse récap Discord invalide.");
  }

  return {
    pickCount: payload.pickCount,
    messageCount: payload.messageCount
  };
}

async function requestClearRedraftPicks() {
  const response = await fetch("/api/redraft-picks", {
    method: "DELETE"
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as RedraftPicksApiResponse;

  return parseRedraftPicksResponse(response, payload);
}

function parseRedraftPicksResponse(
  response: Response,
  payload: RedraftPicksApiResponse
) {
  if (!response.ok) {
    throw new Error(payload.error ?? "Impossible de charger les picks.");
  }

  if (!payload.picks || typeof payload.picks !== "object") {
    throw new Error("Reponse picks invalide.");
  }

  return payload.picks;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Impossible de charger les franchises.";
}
