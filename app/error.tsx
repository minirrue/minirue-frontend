"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        // dvh tracks iOS Safari's actual visible viewport as its toolbar collapses/expands;
        // plain vh resized this full-page state mid-scroll.
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--mr-cream-200)",
        gap: "var(--mr-sp-5)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--mr-font-serif)",
          fontSize: "var(--mr-text-xl)",
          fontWeight: 300,
          color: "var(--mr-ink-900)",
        }}
      >
        Something went wrong
      </h2>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
