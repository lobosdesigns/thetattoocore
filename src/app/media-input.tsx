"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ImageIcon, Video } from "lucide-react";

type MediaInputProps = {
  accept: string;
  maxImageBytes?: number;
  maxVideoBytes?: number;
  name: string;
  required?: boolean;
  videoAllowed?: boolean;
};

type SelectedMedia = {
  error: string | null;
  file: File;
  mediaType: "image" | "video" | "unknown";
  previewUrl: string | null;
};

const inputClass =
  "block w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#efe7da] file:px-3 file:py-1.5 file:text-sm file:font-semibold";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mediaTypeFor(file: File): SelectedMedia["mediaType"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";

  return "unknown";
}

export function MediaInput({
  accept,
  maxImageBytes = 10 * 1024 * 1024,
  maxVideoBytes = 50 * 1024 * 1024,
  name,
  required,
  videoAllowed = true,
}: MediaInputProps) {
  const [selected, setSelected] = useState<SelectedMedia | null>(null);

  const acceptedTypes = useMemo(
    () => new Set(accept.split(",").map((item) => item.trim()).filter(Boolean)),
    [accept],
  );

  useEffect(() => {
    return () => {
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    };
  }, [selected?.previewUrl]);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);

    if (!file) {
      setSelected(null);
      return;
    }

    const mediaType = mediaTypeFor(file);
    const maxBytes = mediaType === "video" ? maxVideoBytes : maxImageBytes;
    const error =
      mediaType === "unknown" || !acceptedTypes.has(file.type)
        ? "Unsupported file type."
        : mediaType === "video" && !videoAllowed
          ? "Video is not supported here."
          : file.size > maxBytes
            ? `${mediaType === "video" ? "Video" : "Image"} limit is ${formatBytes(
                maxBytes,
              )}.`
            : null;

    setSelected({
      error,
      file,
      mediaType,
      previewUrl: mediaType === "image" ? URL.createObjectURL(file) : null,
    });
  }

  const isVideo = selected?.mediaType === "video";

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
      {selected ? (
        <div
          className={`rounded-md border p-3 ${
            selected.error
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-[#d8d1c6] bg-[#f7f4ef] text-[#171412]"
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
              {selected.error ? (
                <p className="mt-2 text-xs font-semibold">{selected.error}</p>
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
