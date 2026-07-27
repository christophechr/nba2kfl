"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NBA_TEAMS, type Team } from "@/data/teams";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  FranchiseOwner,
  FranchiseOwnership,
  FranchiseOwnershipState
} from "@/lib/franchise-db";

type FranchiseOwnershipPayload = FranchiseOwnershipState & {
  error?: string;
};

type OwnerUpdate = {
  userId: string | null;
  label: string | null;
  isPrimary: boolean;
};

type FranchiseOwnershipManagerViewProps = {
  errorMessage: string | null;
  franchises: FranchiseOwnership[];
  isLoading: boolean;
  onChangeOwner: (teamId: string, update: OwnerUpdate) => void;
  ownerOptions: FranchiseOwner[];
  savingTeamId: string | null;
};

export function FranchiseOwnershipManager() {
  const [franchises, setFranchises] = useState<FranchiseOwnership[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<FranchiseOwner[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOwnership() {
      try {
        const state = await requestFranchiseOwnership();

        if (isMounted) {
          setFranchises(state.franchises);
          setOwnerOptions(state.ownerOptions);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(toErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOwnership();

    return () => {
      isMounted = false;
    };
  }, []);

  async function changeOwner(teamId: string, update: OwnerUpdate) {
    setSavingTeamId(teamId);
    setErrorMessage(null);

    try {
      const state = await requestOwnerUpdate(teamId, update);

      setFranchises(state.franchises);
      setOwnerOptions(state.ownerOptions);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingTeamId(null);
    }
  }

  return (
    <FranchiseOwnershipManagerView
      errorMessage={errorMessage}
      franchises={franchises}
      isLoading={isLoading}
      onChangeOwner={changeOwner}
      ownerOptions={ownerOptions}
      savingTeamId={savingTeamId}
    />
  );
}

export function FranchiseOwnershipManagerView({
  errorMessage,
  franchises,
  isLoading,
  onChangeOwner,
  ownerOptions,
  savingTeamId
}: FranchiseOwnershipManagerViewProps) {
  const assignedCount = franchises.filter((franchise) => franchise.owner).length;
  const primaryCount = franchises.filter((franchise) => franchise.isPrimary).length;

  return (
    <section className="lottery-panel workflow-panel" aria-labelledby="ownership-title">
      <div className="lottery-header">
        <div>
          <p className="section-label">Gestion franchises</p>
          <h2 id="ownership-title">Propriétaires long terme</h2>
          <p className="lottery-copy">
            La colonne draft garde l'historique du choix initial. La colonne
            propriétaire pilote les profils, effectifs et opérations futures.
          </p>
        </div>

        <div className="lottery-actions" aria-label="Actions propriétaires">
          <button className="secondary-action" disabled type="button">
            {isLoading ? "Chargement" : "Admin"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="empty-state" role="alert">
          <strong>Gestion proprietaires indisponible</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {!errorMessage ? (
        <>
          <div className="summary-strip" aria-label="Résumé propriétaires">
            <div>
              <span>Franchises</span>
              <strong>{NBA_TEAMS.length}</strong>
            </div>
            <div>
              <span>Attribuées</span>
              <strong>{assignedCount}</strong>
            </div>
            <div>
              <span>Principales</span>
              <strong>{primaryCount}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{isLoading ? "Chargement" : "gm_franchises"}</strong>
            </div>
          </div>

          <div className="selection-table-wrap">
            <table className="selection-table ownership-table">
              <thead>
                <tr>
                  <th scope="col">Franchise</th>
                  <th scope="col">Propriétaire</th>
                  <th scope="col">Libellé</th>
                  <th scope="col">Principale</th>
                  <th scope="col">Draft initiale</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? NBA_TEAMS.map((team) => (
                      <tr key={team.id}>
                        <td colSpan={6}>
                          <Skeleton className="h-[38px] w-full rounded-[10px]" />
                        </td>
                      </tr>
                    ))
                  : NBA_TEAMS.map((team) => {
                      const franchise = findFranchise(franchises, team.id);
                      const ownerUpdate = toOwnerUpdate(franchise);
                      const isSaving = savingTeamId === team.id;

                      return (
                        <tr key={team.id}>
                          <td>
                            <TeamCell team={team} />
                          </td>
                          <td>
                            <select
                              aria-label={`Propriétaire ${team.name}`}
                              className="control-select"
                              disabled={isLoading || savingTeamId !== null}
                              onChange={(event) =>
                                onChangeOwner(team.id, {
                                  ...ownerUpdate,
                                  userId: event.target.value || null
                                })
                              }
                              value={franchise?.owner?.userId ?? ""}
                            >
                              <option value="">Sans propriétaire</option>
                              {ownerOptions.map((owner) => (
                                <option key={owner.userId} value={owner.userId}>
                                  {owner.displayName} - {owner.email}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              aria-label={`Libellé ${team.name}`}
                              className="control-input"
                              defaultValue={franchise?.label ?? ""}
                              disabled={isLoading || savingTeamId !== null}
                              onBlur={(event) =>
                                onChangeOwner(team.id, {
                                  ...ownerUpdate,
                                  label: event.target.value.trim() || null
                                })
                              }
                            />
                          </td>
                          <td>
                            <label className="ownership-primary-toggle">
                              <input
                                checked={Boolean(franchise?.isPrimary)}
                                disabled={
                                  isLoading ||
                                  savingTeamId !== null ||
                                  !franchise?.owner
                                }
                                onChange={(event) =>
                                  onChangeOwner(team.id, {
                                    ...ownerUpdate,
                                    isPrimary: event.target.checked
                                  })
                                }
                                type="checkbox"
                              />
                              <span>Principale</span>
                            </label>
                          </td>
                          <td className="status-cell">
                            {franchise?.draftSlot
                              ? `#${franchise.draftSlot} · ${franchise.draftGmName}`
                              : "Hors draft"}
                          </td>
                          <td className="status-cell">
                            {isSaving
                              ? "Sauvegarde"
                              : franchise?.owner
                                ? franchise.owner.displayName
                                : "Sans propriétaire"}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function TeamCell({ team }: { team: Team }) {
  return (
    <Link className="team-cell" href={`/draft/franchises/${team.id}`}>
      <img src={team.logoUrl} alt="" className="team-logo" loading="lazy" />
      <div>
        <strong>{team.name}</strong>
        <span>{team.abbreviation}</span>
      </div>
    </Link>
  );
}

function findFranchise(
  franchises: readonly FranchiseOwnership[],
  teamId: string
) {
  return franchises.find((franchise) => franchise.teamId === teamId) ?? null;
}

function toOwnerUpdate(franchise: FranchiseOwnership | null): OwnerUpdate {
  return {
    userId: franchise?.owner?.userId ?? null,
    label: franchise?.label ?? null,
    isPrimary: Boolean(franchise?.isPrimary)
  };
}

async function requestFranchiseOwnership() {
  const response = await fetch("/api/franchises");
  const payload = (await response
    .json()
    .catch(() => ({}))) as FranchiseOwnershipPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? "Impossible de charger les propriétaires.");
  }

  if (!Array.isArray(payload.franchises) || !Array.isArray(payload.ownerOptions)) {
    throw new Error("Reponse propriétaires invalide.");
  }

  return payload;
}

async function requestOwnerUpdate(teamId: string, update: OwnerUpdate) {
  const response = await fetch(`/api/franchises/${teamId}/owner`, {
    body: JSON.stringify(update),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as FranchiseOwnershipPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? "Impossible de sauvegarder le propriétaire.");
  }

  if (!Array.isArray(payload.franchises) || !Array.isArray(payload.ownerOptions)) {
    throw new Error("Reponse propriétaires invalide.");
  }

  return payload;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Impossible de charger les propriétaires.";
}
