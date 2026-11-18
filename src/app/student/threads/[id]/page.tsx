"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import type { AppRole } from "@/lib/identity";

interface Message { id: string; sender_id: string; body: string; created_at: string; profiles?: { public_name?: string; role?: string; position?: string }; }
interface Thread { id: string; title: string; visibility: string; student_id: string; }

export default function StudentThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<AppRole>("student");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles")
        .select("role").eq("id", user.id).single();
      if (profile?.role !== "student" && profile?.role !== "community_member") {
        router.push("/login");
        return;
      }
      setRole(profile.role);

      const { data: t } = await supabase.from("threads").select("*").eq("id", id).single();
      if (!t || t.student_id !== user.id) { router.push("/student/threads"); return; }
      setThread(t);

      const { data: msgs } = await supabase
        .from("messages").select("*, profiles(public_name, role, position)").eq("thread_id", id).order("created_at");
      setMessages(msgs ?? []);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!thread) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-messages-${thread.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${thread.id}`,
      }, async (payload) => {
        const row = payload.new as Omit<Message, "profiles">;
        const { data: profile } = await supabase
          .from("profiles").select("public_name, role, position").eq("id", row.sender_id).maybeSingle();
        setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, { ...row, profiles: profile ?? undefined }]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [thread]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !thread) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: msg, error } = await supabase.from("messages")
        .insert({ thread_id: thread.id, sender_id: userId, body: reply.trim() })
        .select("*, profiles(public_name)").single();
      if (error) throw error;
      setMessages(prev => [...prev, msg]);
      setReply("");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not send message.", "error");
    } finally { setLoading(false); }
  }

  function requestToggle() {
    if (!thread) return;
    const next = thread.visibility === "private" ? "shared" : "private";
    setPendingVisibility(next);
    setShowConfirm(true);
  }

  async function confirmToggle() {
    if (!thread) return;
    try {
      const supabase = createClient();
      const patch: Record<string, unknown> = { visibility: pendingVisibility };
      if (pendingVisibility === "shared") patch.shared_at = new Date().toISOString();
      const { error } = await supabase.from("threads").update(patch).eq("id", thread.id);
      if (error) throw error;
      setThread(prev => prev ? { ...prev, visibility: pendingVisibility } : prev);
      showToast(pendingVisibility === "shared"
        ? "Conversation shared with your counselor."
        : "Conversation is now private again.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not update visibility.", "error");
    } finally { setShowConfirm(false); }
  }

  if (!thread) return <div className="page-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  const isShared = thread.visibility === "shared";

  return (
    <main className="page conversation-page">
      <BackToDashboard role={role} compact />
      {/* Header */}
      <div className="conversation-header">
        <div className="conversation-title">
          <h1>{thread.title}</h1>
        </div>
        {/* Visibility toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className={`badge ${isShared ? "badge-brand" : "badge-muted"}`}>
            {isShared ? "🔓 Shared with counselor" : "🔒 Private"}
          </span>
          <label className="toggle" aria-label="Toggle conversation visibility">
            <input type="checkbox" checked={isShared} onChange={requestToggle} id="visibility-toggle" />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Messages */}
      <div className="conversation-scroll">
        <div className="messages-list">
          {messages.map(m => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                <p className="message-author">{mine ? "You" : m.profiles?.role === "counselor"
                  ? <ProfileIdentity name={m.profiles.public_name ?? "Counselor"} role="counselor" position={m.profiles.position} />
                  : (m.profiles?.public_name ?? "Student")}</p>
                <div className={`message-bubble ${mine ? "mine" : "theirs"}`}>{m.body}</div>
                <span className="text-muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply box */}
      <form className="conversation-composer" onSubmit={sendReply}>
        <textarea className="form-textarea" placeholder="Write a message…" value={reply}
          onChange={e => setReply(e.target.value)} style={{ minHeight: 60, flex: 1, resize: "none" }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(e as unknown as React.FormEvent); } }} />
        <button type="submit" className="btn btn-primary" disabled={loading || !reply.trim()}>
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Send"}
        </button>
      </form>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">
              {pendingVisibility === "shared" ? "Share this conversation?" : "Make conversation private?"}
            </h2>
            <p>
              {pendingVisibility === "shared"
                ? "Your counselor will be able to read all messages in this conversation and reply to you."
                : "Your counselor will no longer be able to see this conversation."}
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className={`btn ${pendingVisibility === "shared" ? "btn-primary" : "btn-danger"}`} onClick={confirmToggle}>
                {pendingVisibility === "shared" ? "Yes, share it" : "Yes, make private"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
