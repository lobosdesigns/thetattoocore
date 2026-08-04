"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

type ProtectedVideoProps = {
  ariaLabel?: string;
  className?: string;
  src?: string;
  stopClickPropagation?: boolean;
};

function videoPreviewTime(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return null;

  return Math.min(0.1, duration / 2);
}

function primeVideoPreview(video: HTMLVideoElement | null) {
  if (!video || video.currentTime !== 0) return;
  const previewTime = videoPreviewTime(video.duration);

  if (previewTime !== null) video.currentTime = previewTime;
}

export function ProtectedVideo({
  ariaLabel,
  className,
  src,
  stopClickPropagation = false,
}: ProtectedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => primeVideoPreview(video);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    primeVideoPreview(videoRef.current);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [src]);

  function maybeStopClick(event: MouseEvent<HTMLVideoElement>) {
    if (stopClickPropagation) {
      event.stopPropagation();
    }
  }

  return (
    <video
      aria-label={ariaLabel}
      className={className}
      controls
      controlsList="nodownload noplaybackrate noremoteplayback"
      disablePictureInPicture
      disableRemotePlayback
      onClick={maybeStopClick}
      onContextMenu={(event) => event.preventDefault()}
      onLoadedMetadata={(event) => primeVideoPreview(event.currentTarget)}
      playsInline
      preload="metadata"
      ref={videoRef}
      src={src}
    />
  );
}
