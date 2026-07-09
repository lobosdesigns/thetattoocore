"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ImageIcon, Video } from "lucide-react";

type MediaInputProps = {
  accept: string;
  compact?: boolean;
  maxImageBytes?: number;
  maxVideoBytes?: number;
  maxVideoSeconds?: number;
  name: string;
  required?: boolean;
  videoAllowed?: boolean;
};

type SelectedMedia = {
  error: string | null;
  file: File;
  mediaType: "image" | "video" | "unknown";
  originalFileSize: number | null;
  previewUrl: string | null;
  videoDurationSeconds: number | null;
};

const inputClass =
  "block w-full rounded-md border border-[#cfc8bd] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#e8e4dc] file:px-3 file:py-1.5 file:text-sm file:font-semibold";
const maxImageEdge = 2200;
const compressionPasses = [
  { edge: 2200, quality: 0.86 },
  { edge: 1800, quality: 0.78 },
  { edge: 1400, quality: 0.7 },
  { edge: 1200, quality: 0.62 },
] as const;
const imageOptimizerLabel = "Phone photos are resized before upload.";
const videoPipelineLabel =
  "Video upload is intentionally capped until Cloudflare Stream is worth turning on.";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function reductionPercent(original: number, optimized: number) {
  if (!original || optimized >= original) return 0;

  return Math.round(((original - optimized) / original) * 100);
}

function mediaTypeFor(file: File): SelectedMedia["mediaType"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";

  return "unknown";
}

function optimizedFilename(name: string, type: string) {
  const extension = type === "image/webp" ? "webp" : "jpg";
  const baseName = name.replace(/\.[^.]+$/, "") || "tattoocore-image";

  return `${baseName}.${extension}`;
}

function fileFromBlob(blob: Blob, source: File) {
  return new File([blob], optimizedFilename(source.name, blob.type), {
    lastModified: Date.now(),
    type: blob.type,
  });
}

function replaceInputFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

async function canvasBlobForImage({
  bitmap,
  edge,
  quality,
}: {
  bitmap: ImageBitmap;
  edge: number;
  quality: number;
}) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

async function compressImageFile(file: File, targetBytes: number) {
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);

  if (
    Math.max(bitmap.width, bitmap.height) <= maxImageEdge &&
    file.size <= Math.min(targetBytes, 2 * 1024 * 1024)
  ) {
    bitmap.close();
    return file;
  }

  let bestBlob: Blob | null = null;

  for (const pass of compressionPasses) {
    const blob = await canvasBlobForImage({ bitmap, ...pass });

    if (!blob) continue;
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= targetBytes) break;
  }

  bitmap.close();

  if (!bestBlob || bestBlob.size >= file.size) return file;

  return fileFromBlob(bestBlob, file);
}

async function videoDuration(file: File) {
  if (!file.type.startsWith("video/")) return null;

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<number | null>((resolve) => {
      const video = document.createElement("video");

      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : null;
        resolve(duration);
      };
      video.onerror = () => resolve(null);
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function MediaInput({
  accept,
  compact = false,
  maxImageBytes = 10 * 1024 * 1024,
  maxVideoBytes = 50 * 1024 * 1024,
  maxVideoSeconds = 60,
  name,
  required,
  videoAllowed = true,
}: MediaInputProps) {
  const [selected, setSelected] = useState<SelectedMedia | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const acceptedTypes = useMemo(
    () => new Set(accept.split(",").map((item) => item.trim()).filter(Boolean)),
    [accept],
  );

  useEffect(() => {
    return () => {
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    };
  }, [selected?.previewUrl]);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);

    if (!file) {
      input.setCustomValidity("");
      setSelected(null);
      return;
    }

    const originalMediaType = mediaTypeFor(file);
    const originalMaxBytes =
      originalMediaType === "video" ? maxVideoBytes : maxImageBytes;

    setIsOptimizing(file.type.startsWith("image/") && file.type !== "image/gif");

    const optimizedFile = await compressImageFile(file, originalMaxBytes).catch(
      () => file,
    );
    if (optimizedFile !== file) {
      replaceInputFile(input, optimizedFile);
    }

    setIsOptimizing(false);

    const mediaType = mediaTypeFor(optimizedFile);
    const durationSeconds =
      mediaType === "video" ? await videoDuration(optimizedFile) : null;
    const maxBytes = mediaType === "video" ? maxVideoBytes : maxImageBytes;
    const error =
      mediaType === "unknown" || !acceptedTypes.has(optimizedFile.type)
        ? "Unsupported file type."
        : mediaType === "video" && !videoAllowed
          ? "Video is not supported here."
          : optimizedFile.size > maxBytes
            ? `${mediaType === "video" ? "Video" : "Image"} limit is ${formatBytes(
                maxBytes,
              )}.`
            : mediaType === "video" && durationSeconds == null
              ? "Could not read video duration. Try a standard MP4 or MOV clip."
            : mediaType === "video" &&
                durationSeconds != null &&
                durationSeconds > maxVideoSeconds
              ? `Video clips can be up to ${maxVideoSeconds} seconds.`
            : null;

    input.setCustomValidity(error ?? "");

    setSelected({
      error,
      file: optimizedFile,
      mediaType,
      originalFileSize: optimizedFile.size < file.size ? file.size : null,
      previewUrl:
        mediaType === "image" ? URL.createObjectURL(optimizedFile) : null,
      videoDurationSeconds: durationSeconds,
    });
  }

  const isVideo = selected?.mediaType === "video";
  const guidance = videoAllowed
    ? `${imageOptimizerLabel} Videos stay raw for now: ${formatSeconds(
        maxVideoSeconds,
      )} max, ${formatBytes(maxVideoBytes)} max, MP4/MOV preferred.`
    : `${imageOptimizerLabel} Max image size after optimization is ${formatBytes(
        maxImageBytes,
      )}; GIFs keep their original size.`;
  const savedPercent =
    selected?.originalFileSize && selected.mediaType === "image"
      ? reductionPercent(selected.originalFileSize, selected.file.size)
      : 0;

  return (
    <div className="space-y-2">
      <input
        accept={accept}
        className={inputClass}
        name={name}
        onChange={onChange}
        required={required}
        type="file"
      />
      <p className="text-xs leading-5 text-[#766d62]">
        {compact
          ? videoAllowed
            ? `Optional media. Images optimize before upload; videos max ${formatSeconds(
                maxVideoSeconds,
              )}.`
            : "Optional photo. Images optimize before upload; GIFs keep original size."
          : guidance}
      </p>
      {videoAllowed && !compact ? (
        <p className="rounded-md border border-[#e5ded4] bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#766d62]">
          {videoPipelineLabel} Use short MP4/MOV clips for now; adaptive
          playback and thumbnails come with the managed video pipeline later.
        </p>
      ) : null}
      {isOptimizing && !selected ? (
        <div className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 text-xs font-semibold text-[#766d62]">
          Optimizing image before upload...
        </div>
      ) : null}
      {selected ? (
        <div
          className={`rounded-md border p-3 ${
            selected.error
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-[#cfc8bd] bg-[#fffdf9] text-[#171412]"
          }`}
        >
          <div className="flex gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#171412] text-white">
              {selected.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-full object-cover"
                  src={selected.previewUrl}
                />
              ) : isVideo ? (
                <Video className="size-6" />
              ) : (
                <ImageIcon className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.file.name}</p>
              <p className="mt-1 text-xs">
                {isVideo ? "Video" : "Image"} / {formatBytes(selected.file.size)}
                {selected.file.type ? ` / ${selected.file.type}` : ""}
              </p>
              {selected.videoDurationSeconds != null ? (
                <p className="mt-1 text-xs text-[#766d62]">
                  Duration {formatSeconds(selected.videoDurationSeconds)} / max{" "}
                  {formatSeconds(maxVideoSeconds)}
                </p>
              ) : null}
              {selected.originalFileSize ? (
                <p className="mt-1 text-xs text-[#766d62]">
                  Optimized from {formatBytes(selected.originalFileSize)}
                  {savedPercent ? `, about ${savedPercent}% smaller` : ""}.
                </p>
              ) : null}
              {isVideo && !selected.error ? (
                <p className="mt-1 text-xs text-[#766d62]">
                  Video will upload as-is for now. Keep it short, clear, and
                  under the cap.
                </p>
              ) : null}
              {selected.error ? (
                <p className="mt-2 text-xs font-semibold">{selected.error}</p>
              ) : isOptimizing ? (
                <p className="mt-2 text-xs text-[#766d62]">
                  Optimizing image before upload...
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#766d62]">
                  Ready to attach. Final checks run again when you publish.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
