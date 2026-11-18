"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";
import { ReferralButton } from "@/components/ReferralButton";

interface Message { id: string; sender_id: string; body: string; created_at: string; profiles?: { public_name?: string; role?: string; position?: string }; }
interface Thread { id: string; title: string; visibility: string; student_id: string; student_role?: string; }

export default function CounselorThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: t } = await supabase.from("threads")
        .select("*, member:profiles!student_id(role)").eq("id", id).single();
      if (!t || t.visibility !== "shared") { router.push("/counselor/threads"); return; }
      setThread({ ...t, student_role: (t.member as { role?: string } | null)?.role });

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
      showToast(err instanceof Error ? err.message : "Could not send reply.", "error");
    } finally { setLoading(false); }
  }

  if (!thread) return <div className="page-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  return (
    <main className="page conversation-page">
      <BackToDashboard role="counselor" compact />
      <div className="conversation-header">
        <div className="conversation-title">
          <h1>{thread.title}</h1>
        </div>
          <span className="badge badge-brand">🔓 Shared</span>
          {thread.student_role === "student" && <ReferralButton studentId={thread.student_id} />}
      </div>

      <div className="conversation-scroll">
        <div className="messages-list">
          {messages.map(m => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                <p className="message-author">{mine
                  ? "You"
                  : m.profiles?.role === "counselor"
                    ? `${m.profiles.public_name ?? "Counselor"}, ${m.profiles.position ?? "Guidance Counselor"}`
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

      <form className="conversation-composer" onSubmit={sendReply}>
        <textarea className="form-textarea" placeholder="Write a reply…" value={reply}
          onChange={e => setReply(e.target.value)} style={{ minHeight: 60, flex: 1, resize: "none" }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(e as unknown as React.FormEvent); } }} />
        <button type="submit" className="btn btn-primary" disabled={loading || !reply.trim()}>
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Reply"}
        </button>
      </form>
    </main>
  );
}
