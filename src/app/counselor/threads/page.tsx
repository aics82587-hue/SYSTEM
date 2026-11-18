import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { ConversationDeleteButton } from "@/components/ConversationDeleteButton";

export default async function CounselorThreadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("public_name, avatar_id, role").eq("id", user.id).single();
  if (profile?.role !== "counselor") redirect("/login");

  const { data: threads } = await supabase
    .from("threads")
    .select("id, title, shared_at, profiles!student_id(public_name)")
    .eq("visibility", "shared")
    .order("shared_at", { ascending: false });

  return (
    <>
      <Navbar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          <div className="section-header">
            <div>
              <h1 className="section-title">Conversations</h1>
            </div>
            <Link href="/counselor/threads/new" className="btn btn-primary btn-sm">+ New Conversation</Link>
          </div>

          {!threads?.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>No shared conversations</h3>
              <p>Shared conversations with students will appear here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {threads.map((t: Record<string, unknown>) => (
                <article key={t.id as string} className="thread-item thread-item-row">
                  <Link href={`/counselor/threads/${t.id}`} className="thread-item-link">
                    <div className="flex items-center justify-between">
                      <span className="thread-title">{t.title as string}</span>
                      <span className="badge badge-brand">🔓 Shared</span>
                    </div>
                    <div className="thread-meta">
                      <span className="text-muted">{(t.profiles as { public_name?: string })?.public_name ?? "Unknown"}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">
                        Shared {t.shared_at ? new Date(t.shared_at as string).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </Link>
                  <ConversationDeleteButton
                    threadId={t.id as string}
                    viewerRole="counselor"
                    isShared
                  />
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
