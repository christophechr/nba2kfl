"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Nba2kRosterPlayerSummary } from "@/lib/nba2k-roster-db";
import {
  isRedraftPlayerSelected,
  normalizeRedraftPlayerIdentity,
  type SnakeDraftPick
} from "@/lib/redraft";
import { PlayerAvatar } from "./player-avatar";
import {
  formatCapHit,
  getPositionChipClasses,
  getRatingTileClasses,
  POSITION_FILTERS,
  POSITION_LABELS
} from "./player-visuals";

type PlayerPickerDialogProps = {
  isUserAllowedToEdit: boolean;
  onConfirm: (playerName: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pick: SnakeDraftPick;
  players: readonly Nba2kRosterPlayerSummary[];
  selectedPlayer: string;
  selectedPlayers: ReadonlySet<string>;
  teamName: string | null;
};

export function filterRosterPlayers({
  players,
  position,
  search,
  selectedPlayer,
  selectedPlayers
}: {
  players: readonly Nba2kRosterPlayerSummary[];
  position: string;
  search: string;
  selectedPlayer: string;
  selectedPlayers: ReadonlySet<string>;
}): Nba2kRosterPlayerSummary[] {
  const normalizedSearch = search.trim().toLowerCase();

  return players
    .filter(
      (player) =>
        normalizeRedraftPlayerIdentity(player.fullName) ===
          normalizeRedraftPlayerIdentity(selectedPlayer) ||
        !isRedraftPlayerSelected(player.fullName, selectedPlayers)
    )
    .filter(
      (player) =>
        !normalizedSearch || player.fullName.toLowerCase().includes(normalizedSearch)
    )
    .filter(
      (player) => position === "all" || (player.position ?? "").includes(position)
    )
    .sort((a, b) => b.rating - a.rating || a.fullName.localeCompare(b.fullName));
}

export function PlayerPickerDialog({
  isUserAllowedToEdit,
  onConfirm,
  onOpenChange,
  open,
  pick,
  players,
  selectedPlayer,
  selectedPlayers,
  teamName
}: PlayerPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string>("all");
  const [pendingPlayer, setPendingPlayer] = useState(selectedPlayer);

  useEffect(() => {
    if (open) {
      setSearch("");
      setPosition("all");
      setPendingPlayer(selectedPlayer);
    }
  }, [open, selectedPlayer]);

  const filteredPlayers = useMemo(
    () =>
      filterRosterPlayers({
        players,
        position,
        search,
        selectedPlayer,
        selectedPlayers
      }),
    [players, position, search, selectedPlayer, selectedPlayers]
  );

  function handleConfirm() {
    onConfirm(pendingPlayer);
    onOpenChange(false);
  }

  function handleClearSelection() {
    onConfirm("");
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choisir un joueur · Pick #{pick.pickNumber}</DialogTitle>
          <DialogDescription>
            Tour {pick.round}.{pick.roundPick}
            {teamName ? ` · ${teamName}` : ""} · {pick.selection.gmName} · Cap hit
            2026‑27
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-rows-[auto_1fr] gap-3 overflow-hidden px-5 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_170px] gap-2 max-[560px]:grid-cols-1">
            <Input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un joueur…"
              type="text"
              value={search}
            />
            <Select onValueChange={setPosition} value={position}>
              <SelectTrigger aria-label="Filtrer par poste">
                <span className="truncate">{POSITION_LABELS[position as (typeof POSITION_FILTERS)[number]] ?? POSITION_LABELS.all}</span>
              </SelectTrigger>
              <SelectContent>
                {POSITION_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {POSITION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-y-auto pr-1">
            {filteredPlayers.length === 0 ? (
              <div className="grid min-h-[160px] content-center justify-items-center gap-1 text-center">
                <strong className="text-[0.92rem] font-[720] text-command-ink">
                  Aucun joueur trouvé
                </strong>
                <p className="m-0 text-[0.8rem] text-command-muted-strong">
                  Ajuste la recherche ou les filtres.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
                {filteredPlayers.map((player) => {
                  const isSelected = pendingPlayer === player.fullName;

                  return (
                    <button
                      className={cn(
                        "flex items-stretch overflow-hidden rounded-[12px] border text-left transition duration-150 ease-out",
                        isSelected
                          ? "border-command-accent shadow-[0_0_0_3px_rgba(94,106,210,0.14)]"
                          : "border-command-border hover:border-command-border-strong"
                      )}
                      key={player.sourcePlayerId}
                      onClick={() => setPendingPlayer(player.fullName)}
                      type="button"
                    >
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5",
                          isSelected
                            ? "bg-command-accent-soft"
                            : "bg-command-surface hover:bg-command-surface-muted"
                        )}
                      >
                        <span className="relative shrink-0">
                          <PlayerAvatar
                            className="h-10 w-10"
                            nbaPlayerId={player.nbaPlayerId}
                          />
                          {isSelected ? (
                            <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full border-2 border-command-surface bg-command-accent text-white">
                              <Check aria-hidden size={11} />
                            </span>
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[0.88rem] font-[720] text-command-ink">
                            {player.fullName}
                          </span>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <Badge
                              className={getPositionChipClasses(player.position)}
                              variant="muted"
                            >
                              {player.position ?? "?"}
                            </Badge>
                            {formatCapHit(player.contractCapHit2026) ? (
                              <Badge variant="success">
                                {formatCapHit(player.contractCapHit2026)}
                              </Badge>
                            ) : (
                              <Badge variant="muted">UFA</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "grid w-14 shrink-0 place-items-center text-[1.05rem] font-[800] tracking-[-0.01em]",
                          getRatingTileClasses(player.rating)
                        )}
                      >
                        {player.rating}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div>
            {selectedPlayer ? (
              <Button onClick={handleClearSelection} variant="secondary">
                Retirer la sélection
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onOpenChange(false)} variant="secondary">
              Annuler
            </Button>
            <Button
              disabled={!isUserAllowedToEdit || !pendingPlayer}
              onClick={handleConfirm}
            >
              Valider
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
