"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";
import { ProfileIdentity } from "@/components/ProfileIdentity";

interface Post {
  id: string; body: string; created_at: string; is_hidden: boolean;
  author_id: string; profiles?: { public_name?: string; role?: string; position?: string; avatar_id?: string };
}

export default function FocusGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [groupId, setGroupId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"student" | "counselor" | "moderator" | "community_member">("student");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      setGroupId(id);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role === "student" || profile?.role === "counselor" || profile?.role === "moderator" || profile?.role === "community_member") {
        setRole(profile.role);
      }

      // Check membership
      const { data: member } = await supabase
        .from("focus_group_members").select("user_id").eq("group_id", id).eq("user_id", user.id).single();
      if (!member) { router.push("/focus-groups"); return; }

      const { data: group } = await supabase.from("focus_groups").select("title").eq("id", id).single();
      setGroupTitle(group?.title ?? "Group");

      const { data: p } = await supabase
        .from("focus_group_posts").select("*, profiles(public_name, role, position, avatar_id)")
        .eq("group_id", id).order("created_at");
      setPosts(p ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("focus_group_posts")
        .insert({ group_id: groupId, author_id: userId, body: body.trim(), is_hidden: false })
        .select("*, profiles(public_name, role, position, avatar_id)").single();
      if (error) throw error;
      setPosts(prev => [...prev, data]);
      setBody("");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not post.", "error");
    } finally { setPosting(false); }
  }

  async function submitReport() {
    if (!reportingId || !reportReason.trim()) { showToast("Please provide a reason.", "error"); return; }
    try {
      const supabase = createClient();
      const { error } = await supabase.from("post_reports").insert({
        post_id: reportingId, reporter_id: userId, reason: reportReason.trim(), reviewed: false,
      });
      if (error) throw error;
      showToast("Report submitted. Thank you.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not submit report.", "error");
    } finally { setShowReportModal(false); setReportingId(null); setReportReason(""); }
  }

  function openReport(postId: string) { setReportingId(postId); setShowReportModal(true); }

  return (
    <main className="page" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackToDashboard role={role} />
        <h1 style={{ marginTop: "0.5rem", fontSize: "1.5rem" }}>{groupTitle}</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted"><div className="spinner" style={{ width: 20, height: 20 }} /> Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {!posts.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>No posts yet</h3>
              <p>Be the first to share something.</p>
            </div>
          ) : posts.map(p => (
            !p.is_hidden ? (
              <div key={p.id} className="card card-sm post-card">
                <p className="post-author">
                  <ProfileIdentity name={p.profiles?.public_name ?? "Anonymous"} role={p.profiles?.role} position={p.profiles?.position} />
                  {" · "}{new Date(p.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </p>
                <p className="post-body">{p.body}</p>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost btn-sm text-danger" style={{ fontSize: "0.78rem" }}
                    onClick={() => openReport(p.id)}>
                    🚩 Report
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="card card-sm hidden-post">
                <p className="text-muted text-sm">[This post has been removed by a moderator.]</p>
              </div>
            )
          ))}
        </div>
      )}

      {/* Post form */}
      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Add a Post</h2>
        <form onSubmit={submitPost}>
          <div className="form-group">
            <textarea className="form-textarea" placeholder="Share your thoughts…" value={body}
              onChange={e => setBody(e.target.value)} style={{ minHeight: 90 }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={posting || !body.trim()}>
            {posting ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Post"}
          </button>
        </form>
      </div>

      {/* Report modal */}
      {showReportModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">🚩 Report Post</h2>
            <p className="mb-2">Please briefly describe why this post is inappropriate.</p>
            <div className="form-group">
              <textarea className="form-textarea" placeholder="Reason for report…"
                value={reportReason} onChange={e => setReportReason(e.target.value)} style={{ minHeight: 80 }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowReportModal(false); setReportReason(""); }}>Cancel</button>
              <button className="btn btn-danger" onClick={submitReport}>Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
