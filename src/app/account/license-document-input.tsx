"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { FileCheck, FileText } from "lucide-react";

type LicenseDocumentInputProps = {
  accept: string;
  maxBytes?: number;
  name: string;
  required?: boolean;
};

type SelectedDocument = {
  error: string | null;
  file: File;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function LicenseDocumentInput({
  accept,
  maxBytes = 10 * 1024 * 1024,
  name,
  required,
}: LicenseDocumentInputProps) {
  const [selected, setSelected] = useState<SelectedDocument | null>(null);
  const acceptedTypes = useMemo(
    () => new Set(accept.split(",").map((item) => item.trim()).filter(Boolean)),
    [accept],
  );

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      event.currentTarget.setCustomValidity("");
      setSelected(null);
      return;
    }

    const error = !acceptedTypes.has(file.type)
      ? "Use a PDF, JPG, PNG, or WebP license file."
      : file.size > maxBytes
        ? `License files can be up to ${formatBytes(maxBytes)}.`
        : null;

    event.currentTarget.setCustomValidity(error ?? "");
    setSelected({ error, file });
  }

  return (
    <div className="space-y-2">
      <input
        accept={accept}
        className="w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
        name={name}
        onChange={onChange}
        required={required}
        type="file"
      />
      {selected ? (
        <div
          className={`rounded-md border p-3 ${
            selected.error
              ? "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]"
              : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_86%,transparent)] text-[var(--foreground)]"
          }`}
        >
          <div className="flex gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]">
              {selected.error ? (
                <FileText className="size-5" />
              ) : (
                <FileCheck className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.file.name}</p>
              <p className="mt-1 text-xs">
                {formatBytes(selected.file.size)}
                {selected.file.type ? ` / ${selected.file.type}` : ""}
              </p>
              <p
                className={`mt-2 text-xs ${
                  selected.error ? "font-semibold" : "text-[var(--muted-strong)]"
                }`}
              >
                {selected.error ?? "Ready for private admin review."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
