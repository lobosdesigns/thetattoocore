"use client";

import { useEffect } from "react";

export function AuthHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;

    if (
      hash.includes("type=recovery") &&
      window.location.pathname !== "/reset-password"
    ) {
      window.location.replace(`/reset-password${hash}`);
    }
  }, []);

  return null;
}
