import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem", background: "var(--bg)", color: "var(--text-primary)" }}>
      <div>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔍</div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Page Not Found</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary">← Go Home</Link>
      </div>
    </main>
  );
}
