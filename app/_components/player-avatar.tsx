"use client";

import type { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { getPlayerPhotoUrl, PLAYER_SILHOUETTE_URL } from "./player-visuals";

type PlayerAvatarProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  nbaPlayerId: number | null;
};

export function PlayerAvatar({ className, nbaPlayerId, ...props }: PlayerAvatarProps) {
  return (
    <img
      alt=""
      className={cn(
        "shrink-0 rounded-full border border-command-border bg-command-surface-muted object-cover",
        className
      )}
      loading="lazy"
      onError={(event) => {
        if (event.currentTarget.src.endsWith(PLAYER_SILHOUETTE_URL)) {
          return;
        }

        event.currentTarget.src = PLAYER_SILHOUETTE_URL;
      }}
      src={getPlayerPhotoUrl(nbaPlayerId)}
      {...props}
    />
  );
}
