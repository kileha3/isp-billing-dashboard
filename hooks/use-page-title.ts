"use client";

import { useEffect } from "react";

/**
 * Sets the browser tab title when the component mounts.
 * Appends " | NetBill" as a consistent suffix.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | NetBill`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
