"use client";

import { ReactNode, TouchEvent, useRef } from "react";
import { languageStatusDismissEvent } from "./language-status-banner";

const columnIds = [
  "feed",
  "threads",
  "marketplace",
  "gigs",
  "merch",
  "messages",
] as const;

function clampColumn(index: number) {
  return Math.max(0, Math.min(columnIds.length - 1, index));
}

function updateHash(index: number) {
  const id = columnIds[index];
  if (!id || window.location.hash === `#${id}`) return;

  window.history.replaceState(null, "", `#${id}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function dismissLanguageStatus() {
  window.dispatchEvent(new Event(languageStatusDismissEvent));
}

export function ColumnSnapRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartIndex = useRef(0);
  const snapTimer = useRef<number | null>(null);

  function scrollToIndex(index: number, behavior: ScrollBehavior = "smooth") {
    const rail = railRef.current;
    if (!rail) return;

    const nextIndex = clampColumn(index);
    rail.scrollTo({
      behavior,
      left: nextIndex * rail.clientWidth,
    });
    updateHash(nextIndex);
  }

  function nearestIndex() {
    const rail = railRef.current;
    if (!rail || rail.clientWidth <= 0) return 0;

    return clampColumn(Math.round(rail.scrollLeft / rail.clientWidth));
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const touch = event.touches[0];
    if (!rail || !touch) return;

    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartIndex.current = nearestIndex();
    dismissLanguageStatus();
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const isHorizontalSwipe = Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontalSwipe) {
      scrollToIndex(touchStartIndex.current + (deltaX < 0 ? 1 : -1));
      return;
    }

    scrollToIndex(nearestIndex());
  }

  function onScroll() {
    if (snapTimer.current) {
      window.clearTimeout(snapTimer.current);
    }

    snapTimer.current = window.setTimeout(() => {
      scrollToIndex(nearestIndex(), "smooth");
    }, 180);
  }

  return (
    <div
      className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
      onScroll={onScroll}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      ref={railRef}
    >
      {children}
    </div>
  );
}
