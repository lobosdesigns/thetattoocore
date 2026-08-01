"use client";

import type { MouseEvent, SyntheticEvent } from "react";

type ProtectedVideoProps = {
  className?: string;
  src?: string;
  stopClickPropagation?: boolean;
};

function videoPreviewTime(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return null;

  return Math.min(0.001, duration / 2);
}

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

  function primeVideoPreview(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;

    if (video.currentTime !== 0 || video.readyState >= 2) return;
    const previewTime = videoPreviewTime(video.duration);

    if (previewTime !== null) video.currentTime = previewTime;
  }

  return (
    <video
      className={className}
      controls
      controlsList="nodownload noplaybackrate noremoteplayback"
      disablePictureInPicture
      disableRemotePlayback
      onClick={maybeStopClick}
      onContextMenu={(event) => event.preventDefault()}
      onLoadedMetadata={primeVideoPreview}
      playsInline
      preload="metadata"
      src={src}
    />
  );
}
