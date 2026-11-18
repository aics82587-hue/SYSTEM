import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import type { AppRole } from "@/lib/identity";
import { ConversationDeleteButton } from "@/components/ConversationDeleteButton";

export default async function StudentThreadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("public_name, avatar_id, role").eq("id", user.id).single();
  if (profile?.role !== "student" && profile?.role !== "community_member") redirect("/login");
  const role = profile.role as AppRole;

  const { data: threads } = await supabase
    .from("threads").select("id, title, visibility, created_at")
    .eq("student_id", user.id).order("created_at", { ascending: false });

  return (
    <>
      <Navbar role={role} nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role={role} nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          <div className="section-header">
            <div>
              <h1 className="section-title">Conversations</h1>
            </div>
            <Link href="/student/threads/new" className="btn btn-primary btn-sm">+ New Conversation</Link>
          </div>

          {!threads?.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Start a conversation to connect with a counselor.</p>
              <Link href="/student/threads/new" className="btn btn-primary">Start your first conversation</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {threads.map(t => (
                <article key={t.id} className="thread-item thread-item-row">
                  <Link href={`/student/threads/${t.id}`} className="thread-item-link">
                    <div className="flex items-center justify-between">
                      <span className="thread-title">{t.title}</span>
                      <span className={`badge ${t.visibility === "shared" ? "badge-brand" : "badge-muted"}`}>
                        {t.visibility === "shared" ? "🔓 Shared with counselor" : "🔒 Private"}
                      </span>
                    </div>
                    <span className="text-muted text-sm">{new Date(t.created_at).toLocaleDateString()}</span>
                  </Link>
                  <ConversationDeleteButton
                    threadId={t.id}
                    viewerRole="student"
                    isShared={t.visibility === "shared"}
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
