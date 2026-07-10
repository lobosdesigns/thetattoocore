"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LanguageStatusBanner({
  label,
}: {
  label: string;
}) {
  const [isHidden, setIsHidden] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem("ttc-language-status-dismissed") === "true",
  );

  useEffect(() => {
    const storageKey = "ttc-language-status-dismissed";

    const dismiss = () => {
      window.localStorage.setItem(storageKey, "true");
      setIsHidden(true);
    };

    const options: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("click", dismiss, options);
    window.addEventListener("pointerdown", dismiss, options);
    window.addEventListener("scroll", dismiss, options);
    window.addEventListener("touchstart", dismiss, options);

    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss);
      window.removeEventListener("touchstart", dismiss);
    };
  }, []);

  if (isHidden) return null;

  return (
    <section className="border-b border-[#d8d1c6] bg-[#fffdf9] px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-[#4f473f]">
          Language preference: <span className="font-semibold">{label}</span>.
          Posts stay in original text for now.
        </p>
        <Link
          className="w-fit rounded-md border border-[#cfc8bd] bg-white px-3 py-2 text-xs font-semibold"
          href="/account#language-settings"
        >
          Language settings
        </Link>
      </div>
    </section>
  );
}
