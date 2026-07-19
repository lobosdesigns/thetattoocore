"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
  cropApplied: boolean;
  error: string | null;
  file: File;
  imageHeight: number | null;
  imageWidth: number | null;
  mediaType: "image" | "video" | "unknown";
  originalFileSize: number | null;
  previewUrl: string | null;
  sourceFile: File;
  videoDurationSeconds: number | null;
};
type CropAspect = "original" | "square" | "portrait" | "landscape" | "banner";
type CropSettings = {
  aspect: CropAspect;
  focusX: number;
  focusY: number;
  zoom: number;
};

const inputClass =
  "block w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[color-mix(in_srgb,var(--brand-gold)_18%,var(--paper-warm))] file:px-3 file:py-1.5 file:text-sm file:font-semibold";
const maxImageEdge = 2200;
const compressionPasses = [
  { edge: 2200, quality: 0.86 },
  { edge: 1800, quality: 0.78 },
  { edge: 1400, quality: 0.7 },
  { edge: 1200, quality: 0.62 },
] as const;
const imageOptimizerLabel = "Phone photos are resized before upload.";
const videoUploadLabel =
  "Video upload is capped for now. Keep clips short, clear, and ready for review.";
const defaultCropSettings: CropSettings = {
  aspect: "original",
  focusX: 50,
  focusY: 50,
  zoom: 1,
};
const cropAspects: { label: string; value: CropAspect }[] = [
  { label: "Original", value: "original" },
  { label: "Square", value: "square" },
  { label: "Portrait", value: "portrait" },
  { label: "Landscape", value: "landscape" },
  { label: "Banner", value: "banner" },
];

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
  sourceHeight,
  sourceWidth,
  sourceX,
  sourceY,
  quality,
}: {
  bitmap: ImageBitmap;
  edge: number;
  sourceHeight?: number;
  sourceWidth?: number;
  sourceX?: number;
  sourceY?: number;
  quality: number;
}) {
  const sx = sourceX ?? 0;
  const sy = sourceY ?? 0;
  const sw = sourceWidth ?? bitmap.width;
  const sh = sourceHeight ?? bitmap.height;
  const scale = Math.min(1, edge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

function cropAspectValue(aspect: CropAspect, width: number, height: number) {
  if (aspect === "square") return 1;
  if (aspect === "portrait") return 4 / 5;
  if (aspect === "landscape") return 16 / 9;
  if (aspect === "banner") return 3;

  return width / height;
}

function cropPreviewAspectRatio(
  aspect: CropAspect,
  width: number | null,
  height: number | null,
) {
  if (aspect === "square") return "1 / 1";
  if (aspect === "portrait") return "4 / 5";
  if (aspect === "landscape") return "16 / 9";
  if (aspect === "banner") return "3 / 1";
  if (width && height) return `${width} / ${height}`;

  return "1 / 1";
}

function cropRectForImage(bitmap: ImageBitmap, crop: CropSettings) {
  const targetAspect = cropAspectValue(crop.aspect, bitmap.width, bitmap.height);
  const sourceAspect = bitmap.width / bitmap.height;
  let width = bitmap.width;
  let height = bitmap.height;

  if (sourceAspect > targetAspect) {
    width = height * targetAspect;
  } else {
    height = width / targetAspect;
  }

  const zoom = Math.min(2.5, Math.max(1, crop.zoom));
  width = Math.max(1, width / zoom);
  height = Math.max(1, height / zoom);

  const maxX = Math.max(0, bitmap.width - width);
  const maxY = Math.max(0, bitmap.height - height);
  const sourceX = maxX * (Math.min(100, Math.max(0, crop.focusX)) / 100);
  const sourceY = maxY * (Math.min(100, Math.max(0, crop.focusY)) / 100);

  return {
    sourceHeight: height,
    sourceWidth: width,
    sourceX,
    sourceY,
  };
}

async function imageDimensions(file: File) {
  if (!file.type.startsWith("image/")) return { height: null, width: null };

  const bitmap = await createImageBitmap(file);
  const dimensions = { height: bitmap.height, width: bitmap.width };
  bitmap.close();

  return dimensions;
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

async function cropAndCompressImageFile(
  file: File,
  targetBytes: number,
  crop: CropSettings,
) {
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;
  if (crop.aspect === "original" && crop.zoom === 1 && crop.focusX === 50 && crop.focusY === 50) {
    return compressImageFile(file, targetBytes);
  }

  const bitmap = await createImageBitmap(file);
  const cropRect = cropRectForImage(bitmap, crop);
  let bestBlob: Blob | null = null;

  for (const pass of compressionPasses) {
    const blob = await canvasBlobForImage({ bitmap, ...cropRect, ...pass });

    if (!blob) continue;
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= targetBytes) break;
  }

  bitmap.close();

  return bestBlob ? fileFromBlob(bestBlob, file) : compressImageFile(file, targetBytes);
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
  const [cropSettings, setCropSettings] =
    useState<CropSettings>(defaultCropSettings);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setCropSettings(defaultCropSettings);
      return;
    }

    const originalMediaType = mediaTypeFor(file);
    const originalMaxBytes =
      originalMediaType === "video" ? maxVideoBytes : maxImageBytes;

    setIsOptimizing(file.type.startsWith("image/") && file.type !== "image/gif");
    setCropSettings(defaultCropSettings);

    const optimizedFile = await compressImageFile(file, originalMaxBytes).catch(
      () => file,
    );
    if (optimizedFile !== file) {
      replaceInputFile(input, optimizedFile);
    }

    setIsOptimizing(false);

    const mediaType = mediaTypeFor(optimizedFile);
    const dimensions =
      mediaType === "image"
        ? await imageDimensions(optimizedFile).catch(() => ({
            height: null,
            width: null,
          }))
        : { height: null, width: null };
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
      cropApplied: false,
      error,
      file: optimizedFile,
      imageHeight: dimensions.height,
      imageWidth: dimensions.width,
      mediaType,
      originalFileSize: optimizedFile.size < file.size ? file.size : null,
      previewUrl:
        mediaType === "image" ? URL.createObjectURL(optimizedFile) : null,
      sourceFile: file,
      videoDurationSeconds: durationSeconds,
    });
  }

  async function applyCrop() {
    const input = inputRef.current;

    if (!selected || selected.mediaType !== "image" || !input) return;

    setIsOptimizing(true);

    const croppedFile = await cropAndCompressImageFile(
      selected.sourceFile,
      maxImageBytes,
      cropSettings,
    ).catch(() => selected.file);

    const dimensions = await imageDimensions(croppedFile).catch(() => ({
      height: selected.imageHeight,
      width: selected.imageWidth,
    }));

    replaceInputFile(input, croppedFile);
    if (selected.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    setIsOptimizing(false);
    setSelected({
      ...selected,
      cropApplied: true,
      error:
        croppedFile.size > maxImageBytes
          ? `Image limit is ${formatBytes(maxImageBytes)}.`
          : null,
      file: croppedFile,
      imageHeight: dimensions.height,
      imageWidth: dimensions.width,
      originalFileSize:
        croppedFile.size < selected.sourceFile.size ? selected.sourceFile.size : null,
      previewUrl: URL.createObjectURL(croppedFile),
    });
    input.setCustomValidity(
      croppedFile.size > maxImageBytes
        ? `Image limit is ${formatBytes(maxImageBytes)}.`
        : "",
    );
  }

  const isVideo = selected?.mediaType === "video";
  const guidance = videoAllowed
    ? `${imageOptimizerLabel} Videos keep their original quality for now: ${formatSeconds(
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
        ref={inputRef}
        required={required}
        type="file"
      />
      <p className="text-xs leading-5 text-[var(--muted-strong)]">
        {compact
          ? videoAllowed
            ? `Optional media. Images optimize before upload; videos max ${formatSeconds(
                maxVideoSeconds,
              )}.`
            : "Optional photo. Images optimize before upload; GIFs keep original size."
          : guidance}
      </p>
      {videoAllowed && !compact ? (
        <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
          {videoUploadLabel} Use short MP4/MOV clips for now.
        </p>
      ) : null}
      {isOptimizing && !selected ? (
        <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-xs font-semibold text-[var(--muted-strong)]">
          Optimizing image before upload...
        </div>
      ) : null}
      {selected ? (
        <div
          className={`rounded-md border p-3 ${
            selected.error
              ? "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]"
              : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] text-[var(--foreground)]"
          }`}
        >
          <div className="flex gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--foreground)] text-[var(--background)]">
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
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  Duration {formatSeconds(selected.videoDurationSeconds)} / max{" "}
                  {formatSeconds(maxVideoSeconds)}
                </p>
              ) : null}
              {selected.originalFileSize ? (
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  Optimized from {formatBytes(selected.originalFileSize)}
                  {savedPercent ? `, about ${savedPercent}% smaller` : ""}.
                </p>
              ) : null}
              {isVideo && !selected.error ? (
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  Video will keep its original quality for now. Keep it short,
                  clear, and under the cap.
                </p>
              ) : null}
              {selected.mediaType === "image" && selected.file.type !== "image/gif" ? (
                <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_86%,transparent)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    Edit crop
                  </p>
                  {selected.previewUrl ? (
                    <div className="mt-2 rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] p-2">
                      <div
                        className="mx-auto max-h-48 w-full max-w-80 overflow-hidden rounded bg-black"
                        style={{
                          aspectRatio: cropPreviewAspectRatio(
                            cropSettings.aspect,
                            selected.imageWidth,
                            selected.imageHeight,
                          ),
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt="Crop preview"
                          className="size-full object-cover"
                          src={selected.previewUrl}
                          style={{
                            objectPosition: `${cropSettings.focusX}% ${cropSettings.focusY}%`,
                            transform: `scale(${cropSettings.zoom})`,
                            transformOrigin: `${cropSettings.focusX}% ${cropSettings.focusY}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[var(--background)]">
                        Preview the framing, then apply before publishing.
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold">
                      Shape
                      <select
                        className="h-9 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-xs text-[var(--foreground)]"
                        onChange={(event) =>
                          setCropSettings((current) => ({
                            ...current,
                            aspect: event.target.value as CropAspect,
                          }))
                        }
                        value={cropSettings.aspect}
                      >
                        {cropAspects.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">
                      Zoom
                      <input
                        max="2.5"
                        min="1"
                        onChange={(event) =>
                          setCropSettings((current) => ({
                            ...current,
                            zoom: Number(event.target.value),
                          }))
                        }
                        step="0.05"
                        type="range"
                        value={cropSettings.zoom}
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">
                      Left / right focus
                      <input
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setCropSettings((current) => ({
                            ...current,
                            focusX: Number(event.target.value),
                          }))
                        }
                        type="range"
                        value={cropSettings.focusX}
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">
                      Up / down focus
                      <input
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setCropSettings((current) => ({
                            ...current,
                            focusY: Number(event.target.value),
                          }))
                        }
                        type="range"
                        value={cropSettings.focusY}
                      />
                    </label>
                  </div>
                  <button
                    className="mt-3 h-9 rounded-md bg-[var(--foreground)] px-4 text-xs font-semibold text-[var(--background)]"
                    onClick={applyCrop}
                    type="button"
                  >
                    {selected.cropApplied ? "Apply crop again" : "Apply crop"}
                  </button>
                </div>
              ) : null}
              {selected.error ? (
                <p className="mt-2 text-xs font-semibold">{selected.error}</p>
              ) : isOptimizing ? (
                <p className="mt-2 text-xs text-[var(--muted-strong)]">
                  Optimizing image before upload...
                </p>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted-strong)]">
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
