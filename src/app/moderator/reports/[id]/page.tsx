"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";

interface Report {
  id: string; reason: string; reviewed: boolean;
  post_id: string;
  focus_group_posts?: { id: string; body: string; is_hidden: boolean; author_id: string; profiles?: { public_name?: string } };
}

export default function ModeratorReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [restrictDays, setRestrictDays] = useState("7");
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "moderator") { router.push("/login"); return; }

      const { data } = await supabase.from("post_reports")
        .select("*, focus_group_posts(id, body, is_hidden, author_id, profiles(public_name))")
        .eq("id", id).single();
      setReport(data ?? null);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hidePost() {
    if (!report?.focus_group_posts) return;
    setActioning(true);
    try {
      const supabase = createClient();
      await supabase.from("focus_group_posts").update({ is_hidden: true }).eq("id", report.post_id);
      await supabase.from("post_reports").update({ reviewed: true }).eq("id", report.id);
      showToast("Post hidden.", "success");
      setReport(prev => prev ? { ...prev, reviewed: true, focus_group_posts: prev.focus_group_posts ? { ...prev.focus_group_posts, is_hidden: true } : undefined } : prev);
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setActioning(false); }
  }

  async function warnUser() {
    if (!report?.focus_group_posts?.author_id) return;
    setActioning(true);
    try {
      const supabase = createClient();
      await supabase.from("user_warnings").insert({ user_id: report.focus_group_posts.author_id, reason: report.reason });
      await supabase.from("post_reports").update({ reviewed: true }).eq("id", report.id);
      showToast("Warning issued.", "success");
      setReport(prev => prev ? { ...prev, reviewed: true } : prev);
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setActioning(false); }
  }

  async function restrictUser() {
    if (!report?.focus_group_posts?.author_id) return;
    setActioning(true);
    try {
      const supabase = createClient();
      const until = new Date();
      until.setDate(until.getDate() + parseInt(restrictDays, 10));
      const { error: restrictError } = await supabase.rpc("set_member_restriction", {
        _user_id: report.focus_group_posts.author_id,
        _restricted: true,
        _until: until.toISOString(),
      });
      if (restrictError) throw restrictError;
      const { error: reportError } = await supabase.from("post_reports").update({ reviewed: true }).eq("id", report.id);
      if (reportError) throw reportError;
      showToast(`User restricted for ${restrictDays} days.`, "success");
      setReport(prev => prev ? { ...prev, reviewed: true } : prev);
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setActioning(false); }
  }

  async function markReviewed() {
    if (!report) return;
    setActioning(true);
    try {
      const supabase = createClient();
      await supabase.from("post_reports").update({ reviewed: true }).eq("id", report.id);
      showToast("Marked as reviewed.", "info");
      setReport(prev => prev ? { ...prev, reviewed: true } : prev);
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setActioning(false); }
  }

  if (!report) return <div className="page-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  const post = report.focus_group_posts;

  return (
    <main className="page" style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <BackToDashboard role="moderator" />
        <Link href="/moderator/reports" className="text-muted text-sm">← Back to reports</Link>
      </div>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ fontSize: "1.4rem" }}>Report Review</h1>
        <span className={`badge ${report.reviewed ? "badge-muted" : "badge-warning"}`}>
          {report.reviewed ? "Reviewed" : "Pending"}
        </span>
      </div>

      {/* Post */}
      <div className="card mb-3" style={post?.is_hidden ? { opacity: 0.55 } : {}}>
        <p className="text-muted text-sm mb-1">Post by: <strong style={{ color: "var(--text-primary)" }}>{post?.profiles?.public_name ?? "Unknown"}</strong></p>
        <p style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>{post?.body ?? "[Post not found]"}</p>
        {post?.is_hidden && <div className="badge badge-danger mt-2">Hidden</div>}
      </div>

      {/* Report reason */}
      <div className="notice notice-danger mb-3">
        <p style={{ fontSize: "0.88rem" }}><strong>Report reason:</strong> {report.reason}</p>
      </div>

      {/* Actions */}
      {!report.reviewed && (
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Moderator Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <button className="btn btn-danger" disabled={actioning || post?.is_hidden} onClick={hidePost}>
                🙈 Hide Post
              </button>
              <p className="form-hint mt-1">Removes the post from the feed. Other members will see &lsquo;[Removed]&rsquo;.</p>
            </div>
            <hr className="divider" />
            <div>
              <button className="btn btn-secondary" disabled={actioning} onClick={warnUser}>
                ⚠️ Warn User
              </button>
              <p className="form-hint mt-1">Logs a warning on the user&apos;s record.</p>
            </div>
            <hr className="divider" />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <button className="btn btn-danger" disabled={actioning} onClick={restrictUser}>
                  🚫 Restrict User
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="text-muted text-sm">for</span>
                  <select className="form-select" style={{ width: 100 }} value={restrictDays} onChange={e => setRestrictDays(e.target.value)}>
                    {["1","3","7","14","30"].map(d => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
              </div>
              <p className="form-hint mt-1">Prevents the user from posting in focus groups for the selected duration.</p>
            </div>
            <hr className="divider" />
            <button className="btn btn-ghost" disabled={actioning} onClick={markReviewed}>
              ✅ Mark as Reviewed (no action needed)
            </button>
          </div>
        </div>
      )}

      {report.reviewed && (
        <div className="notice notice-success">
          <p>This report has been reviewed. No further action required.</p>
        </div>
      )}
    </main>
  );
}
