"use client";

import { useEffect } from "react";

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
        minHeight: "100vh",
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
      <button
        onClick={reset}
        style={{
          fontFamily: "var(--mr-font-label)",
          fontSize: "var(--mr-text-sm)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--mr-ink-900)",
          background: "transparent",
          border: "1px solid var(--mr-border)",
          padding: "var(--mr-sp-3) var(--mr-sp-6)",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
