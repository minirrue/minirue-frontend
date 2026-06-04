import Link from "next/link";

export default function NotFound() {
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
      <p
        style={{
          fontFamily: "var(--mr-font-label)",
          fontSize: "var(--mr-text-xs)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--mr-ink-400)",
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: "var(--mr-font-serif)",
          fontSize: "var(--mr-text-2xl)",
          fontWeight: 300,
          color: "var(--mr-ink-900)",
        }}
      >
        Page not found
      </h1>
      <Link
        href="/"
        style={{
          fontFamily: "var(--mr-font-label)",
          fontSize: "var(--mr-text-sm)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--mr-gold-500)",
          textDecoration: "none",
        }}
      >
        Return home
      </Link>
    </main>
  );
}
