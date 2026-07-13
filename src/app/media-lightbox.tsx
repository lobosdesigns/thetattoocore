"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import { ProtectedVideo } from "./protected-video";

type MediaLightboxProps = {
  alt?: string;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  mediaType: "image" | "video";
  src: string;
  title?: string;
};

export function MediaLightbox({
  alt = "",
  children,
  description,
  footer,
  mediaType,
  src,
  title = "Media viewer",
}: MediaLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setZoom(1);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function openFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (src) {
        setZoom(1);
        setIsOpen(true);
      }
    }
  }

  return (
    <>
      <div
        aria-label="Open media viewer"
        className="group relative cursor-zoom-in"
        onClick={() => {
          if (src) {
            setZoom(1);
            setIsOpen(true);
          }
        }}
        onKeyDown={openFromKeyboard}
        role="button"
        tabIndex={0}
      >
        {children}
        <span className="pointer-events-none absolute right-3 top-3 flex size-9 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--foreground)_82%,transparent)] text-[var(--background)] opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </div>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black text-white"
          role="dialog"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/15 bg-black px-3 py-2 text-white">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-white">
                {title}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/75">
                {description ??
                  (mediaType === "image"
                    ? "Double tap or use zoom controls to inspect detail."
                    : "Focused playback opens here.")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mediaType === "image" ? (
                <>
                  <button
                    aria-label="Zoom out"
                    className="flex size-10 items-center justify-center rounded-md border border-white/25 bg-white/10 text-white"
                    onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
                    type="button"
                  >
                    <Minus className="size-4" />
                  </button>
                  <button
                    aria-label="Reset zoom"
                    className="flex h-10 min-w-14 items-center justify-center rounded-md border border-white/25 bg-white/10 px-2 text-xs font-bold tabular-nums text-white"
                    onClick={() => setZoom(1)}
                    type="button"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    aria-label="Zoom in"
                    className="flex size-10 items-center justify-center rounded-md border border-white/25 bg-white/10 text-white"
                    onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                    type="button"
                  >
                    <Plus className="size-4" />
                  </button>
                </>
              ) : null}
              <button
                aria-label="Close media viewer"
                className="flex size-10 items-center justify-center rounded-md border border-white/25 bg-white/10 text-white"
                onClick={() => {
                  setIsOpen(false);
                  setZoom(1);
                }}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black p-3"
            onClick={() => {
              setIsOpen(false);
              setZoom(1);
            }}
          >
            {mediaType === "video" ? (
              <ProtectedVideo
                className="max-h-full max-w-full bg-black"
                src={src}
                stopClickPropagation
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={alt}
                className={`select-none object-contain transition-[width] ${
                  zoom === 1 ? "max-h-full max-w-full" : "max-w-none"
                }`}
                onDoubleClick={() =>
                  setZoom((value) => (value === 1 ? 2 : 1))
                }
                onClick={(event) => event.stopPropagation()}
                src={src}
                style={{
                  cursor: zoom === 1 ? "zoom-in" : "zoom-out",
                  width: zoom === 1 ? undefined : `${zoom * 100}%`,
                }}
              />
            )}
          </div>
          {footer ? (
            <div className="border-t border-white/15 bg-black px-3 py-3 text-white">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
