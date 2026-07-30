"use client";

import { useEffect, useState } from "react";

// useNewBadge marks a menu entry as new until a fixed cut-off date, given as an
// ISO string with an offset (e.g. "2026-08-07T23:59:59+07:00") so the badge
// expires at the same moment for everyone regardless of their device timezone.
//
// Resolved in an effect rather than during render: these pages are prerendered at
// build time, so comparing the clock while rendering would bake the answer into
// the static HTML and mismatch on hydration once the date passes.
export function useNewBadge(until: string) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const deadline = new Date(until).getTime();
    if (Number.isNaN(deadline)) return; // malformed date: just don't show it
    setIsNew(Date.now() < deadline);
  }, [until]);

  return isNew;
}
