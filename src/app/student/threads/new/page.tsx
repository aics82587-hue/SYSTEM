"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";
import type { AppRole } from "@/lib/identity";

export default function NewThreadPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState<AppRole>("student");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { showToast("Title and message are required.", "error"); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "student" && profile?.role !== "community_member") throw new Error("This conversation form is for BSC community members.");
      setRole(profile.role);

      const { data: conversationId, error } = await supabase.rpc("create_conversation", {
        _title: title.trim(),
        _body: body.trim(),
        _student_id: null,
      });
      if (error) throw new Error("Could not create conversation. Please check your details and try again.");
      showToast("Conversation created!", "success");
      router.push(`/student/threads/${conversationId}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not create conversation. Please try again.", "error");
    } finally { setLoading(false); }
  }

  return (
    <main className="page" style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <BackToDashboard role={role} />
      </div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>Start a Conversation</h1>
      <p className="text-muted mb-3">Your conversation is private by default. You can share it with a counselor later.</p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Conversation Title</label>
            <input id="title" className="form-input" type="text" placeholder="What's on your mind?"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="body">First Message</label>
            <textarea id="body" className="form-textarea" placeholder="Write your thoughts here…"
              value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 140 }} />
          </div>
          <div className="notice mb-2">
            <span style={{ fontSize: "0.85rem" }}>🔒 This conversation will be <strong>private</strong> until you choose to share it with a counselor.</span>
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Create Conversation"}
          </button>
        </form>
      </div>
    </main>
  );
}
