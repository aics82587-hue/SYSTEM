import { BrainLogo } from "@/components/BrainLogo";

export default function Loading() {
  return (
    <main className="page-center" role="status" aria-label="Loading MenTalks">
      <div className="flex flex-col items-center gap-2 text-muted">
        <BrainLogo size={42} />
        <strong className="auth-wordmark">MenTalks</strong>
        <span>Loading MenTalks…</span>
      </div>
    </main>
  );
}
