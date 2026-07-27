"use client";

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
import { isRedraftPlayerSelected } from "@/lib/redraft";
import { PlayerAvatar } from "./player-avatar";
import {
  formatCapHit,
  getPositionChipClasses,
  getRatingTileClasses,
  POSITION_FILTERS,
  POSITION_LABELS
} from "./player-visuals";

type RosterStatusFilter = "available" | "taken";

const STATUS_FILTERS: { label: string; value: RosterStatusFilter }[] = [
  { label: "Restants", value: "available" },
  { label: "Sélectionnés", value: "taken" }
];

type PlayerRosterDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  players: readonly Nba2kRosterPlayerSummary[];
  selectedPlayers: ReadonlySet<string>;
};

export function filterRosterByStatus({
  players,
  position,
  search,
  selectedPlayers,
  status
}: {
  players: readonly Nba2kRosterPlayerSummary[];
  position: string;
  search: string;
  selectedPlayers: ReadonlySet<string>;
  status: RosterStatusFilter;
}): Nba2kRosterPlayerSummary[] {
  const normalizedSearch = search.trim().toLowerCase();

  return players
    .filter((player) =>
      status === "taken"
        ? isRedraftPlayerSelected(player.fullName, selectedPlayers)
        : !isRedraftPlayerSelected(player.fullName, selectedPlayers)
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

export function PlayerRosterDialog({
  onOpenChange,
  open,
  players,
  selectedPlayers
}: PlayerRosterDialogProps) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string>("all");
  const [status, setStatus] = useState<RosterStatusFilter>("available");

  useEffect(() => {
    if (open) {
      setSearch("");
      setPosition("all");
      setStatus("available");
    }
  }, [open]);

  const filteredPlayers = useMemo(
    () =>
      filterRosterByStatus({
        players,
        position,
        search,
        selectedPlayers,
        status
      }),
    [players, position, search, selectedPlayers, status]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liste des joueurs</DialogTitle>
          <DialogDescription>
            {filteredPlayers.length} joueur
            {filteredPlayers.length > 1 ? "s" : ""}{" "}
            {status === "taken" ? "déjà sélectionnés" : "encore disponibles"} · Cap hit 2026‑27
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-rows-[auto_auto_1fr] gap-3 overflow-hidden px-5 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_170px] gap-2 max-[560px]:grid-cols-1">
            <Input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un joueur…"
              type="text"
              value={search}
            />
            <Select onValueChange={setPosition} value={position}>
              <SelectTrigger aria-label="Filtrer par poste">
                <span className="truncate">
                  {POSITION_LABELS[position as (typeof POSITION_FILTERS)[number]] ??
                    POSITION_LABELS.all}
                </span>
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

          <div className="inline-flex w-fit items-center gap-0.5 rounded-[14px] border border-command-border bg-command-surface-muted/70 p-1">
            {STATUS_FILTERS.map((option) => (
              <button
                className={cn(
                  "rounded-[10px] px-3 py-1.5 text-[0.81rem] font-[650] leading-none transition duration-150 ease-out",
                  status === option.value
                    ? "bg-command-surface text-command-ink shadow-[0_1px_0_rgba(16,24,40,0.04)]"
                    : "text-command-muted-strong hover:bg-command-surface hover:text-command-ink"
                )}
                key={option.value}
                onClick={() => setStatus(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
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
                {filteredPlayers.map((player) => (
                  <div
                    className="flex items-stretch overflow-hidden rounded-[12px] border border-command-border"
                    key={player.sourcePlayerId}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 bg-command-surface px-3 py-2.5">
                      <PlayerAvatar className="h-10 w-10" nbaPlayerId={player.nbaPlayerId} />
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div />
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
