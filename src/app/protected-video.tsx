"use client";

import type { MouseEvent } from "react";

type ProtectedVideoProps = {
  className?: string;
  src?: string;
  stopClickPropagation?: boolean;
};

export function ProtectedVideo({
  className,
  src,
  stopClickPropagation = false,
}: ProtectedVideoProps) {
  function maybeStopClick(event: MouseEvent<HTMLVideoElement>) {
    if (stopClickPropagation) {
      event.stopPropagation();
    }
  }

  return (
    <video
      className={className}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      onClick={maybeStopClick}
      onContextMenu={(event) => event.preventDefault()}
      playsInline
      preload="metadata"
      src={src}
    />
  );
}
