import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";

export default async function ModeratorReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("public_name, avatar_id, role").eq("id", user.id).single();
  if (profile?.role !== "moderator") redirect("/login");

  const { data: reports } = await supabase
    .from("post_reports")
    .select("id, reason, reviewed, created_at, post_id, focus_group_posts(body, is_hidden, author_id, profiles(public_name))")
    .order("created_at", { ascending: false });

  return (
    <>
      <Navbar role="moderator" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="moderator" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          <h1 className="section-title mb-3">Reported Posts</h1>
          {!reports?.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <h3>No reports</h3>
              <p>Everything looks good!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {reports.map((r: Record<string, unknown>) => {
                const post = r.focus_group_posts as Record<string, unknown> | null;
                return (
                  <Link key={r.id as string} href={`/moderator/reports/${r.id}`}
                    className={`card card-sm report-card ${r.reviewed ? "" : ""}`}
                    style={{ textDecoration: "none", opacity: r.reviewed ? 0.55 : 1 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="badge badge-danger">🚩 Report</span>
                      <span className={`badge ${r.reviewed ? "badge-muted" : "badge-warning"}`}>
                        {r.reviewed ? "Reviewed" : "Pending"}
                      </span>
                    </div>
                    <p style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "0.9rem" }}>
                      Post by: {(post?.profiles as { public_name?: string })?.public_name ?? "Unknown"}
                    </p>
                    <p className="text-muted text-sm" style={{ marginTop: "0.2rem" }}>
                      Post: &ldquo;{String(post?.body ?? "").slice(0, 100)}{String(post?.body ?? "").length > 100 ? "…" : ""}&rdquo;
                    </p>
                    <p className="text-muted text-sm">Reason: {r.reason as string}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
