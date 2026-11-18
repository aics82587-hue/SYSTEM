"use client";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0F0F1A", color: "#F0EFFF", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center", padding: "2rem" }}>
        <div>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>😔</div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#A09DC0", marginBottom: "1.5rem", maxWidth: 400 }}>
            We&apos;re sorry — an unexpected error occurred. Your data is safe. Please try again or return home.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre style={{ background: "#1E1E36", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", textAlign: "left", marginBottom: "1.5rem", maxWidth: 500, overflow: "auto", color: "#F87171" }}>
              {error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button onClick={reset} style={{ padding: "0.65rem 1.5rem", background: "var(--brand-dark)", color: "#fff", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: 600 }}>
              Try Again
            </button>
            <Link href="/" style={{ padding: "0.65rem 1.5rem", background: "var(--bg-elevated)", color: "var(--text-primary)", borderRadius: "12px", textDecoration: "none", fontWeight: 600, border: "1px solid var(--border)" }}>
              Go Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
