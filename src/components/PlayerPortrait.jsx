import {
  useEffect,
  useState,
} from "react";

import {
  getPlayerAvatar,
  PLAYER_SILHOUETTE,
} from "../utils/playerIdentity";

export default function PlayerPortrait({
  player,
  alt,
  className = "",
  imageClassName = "",
  teamLogo = null,
  showTeamBackground = false,
}) {
  const resolvedSource =
    getPlayerAvatar(player);

  const [source, setSource] =
    useState(resolvedSource);

  useEffect(() => {
    setSource(resolvedSource);
  }, [resolvedSource]);

  const silhouette =
    source === PLAYER_SILHOUETTE;

  return (
    <div
      className={[
        "relative overflow-hidden",
        className,
      ].join(" ")}
    >
      {showTeamBackground &&
        teamLogo && (
          <img
            src={teamLogo}
            alt=""
            className="absolute inset-0 h-full w-full scale-125 object-contain opacity-[0.12] blur-[1px]"
          />
        )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#0b121b] via-transparent to-transparent" />

      <img
        src={source}
        alt={
          alt ||
          player?.nickname ||
          "Player"
        }
        onError={() => {
          setSource(
            PLAYER_SILHOUETTE
          );
        }}
        className={[
          "absolute inset-0 h-full w-full",
          silhouette
            ? "object-cover object-center"
            : "object-cover object-top",
          imageClassName,
        ].join(" ")}
      />
    </div>
  );
}
