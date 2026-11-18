"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { UrgentWarningDialog } from "@/components/UrgentWarningDialog";
import { VoiceMessageRecorder } from "@/components/VoiceMessageRecorder";
import { TTSPlayer } from "@/components/TTSPlayer";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import { useToast } from "@/components/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import type { AppRole } from "@/lib/identity";

interface Message {
  id: string;
  student_id: string;
  sender_id: string;
  body: string | null;
  voice_url: string | null;
  is_urgent: boolean;
  urgent_acknowledged: boolean;
  flag_color: "yellow" | "orange" | "red" | null;
  is_removed: boolean;
  is_read: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export default function StudentMessagesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [avatarId, setAvatarId] = useState("lavender-cat");
  const [role, setRole] = useState<AppRole>("student");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [textBody, setTextBody] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [showUrgentDialog, setShowUrgentDialog] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [sending, setSending] = useState(false);
  const [counselorStatus, setCounselorStatus] = useState<string>("available");
  const [counselorIdentity, setCounselorIdentity] = useState<{ nickname: string; position: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"messages" | "archived">("messages");
  const [searchText, setSearchText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const supabase = createClient();

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("public_name, avatar_id, role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "student" && profile?.role !== "community_member") {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setRole(profile.role);
      setNickname(profile?.public_name ?? "Student");
      setAvatarId(profile.avatar_id ?? "lavender-cat");

      // Fetch counselor status
      const { data: counselorProfile } = await supabase
        .from("profiles")
        .select("id, public_name, position")
        .eq("role", "counselor")
        .limit(1)
        .maybeSingle();

      if (counselorProfile) {
        setCounselorIdentity({
          nickname: counselorProfile.public_name,
          position: counselorProfile.position ?? "Guidance Counselor",
        });
        const { data: cs } = await supabase
          .from("counselor_status")
          .select("status")
          .eq("counselor_id", counselorProfile.id)
          .maybeSingle();
        if (cs?.status) {
          setCounselorStatus(cs.status);
        }
      }

      // Fetch messages for this student
      const { data: msgs, error } = await supabase
        .from("private_messages")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: true });

      if (!error && msgs) {
        setMessages(msgs as Message[]);
      } else if (error) {
        showToast(`Could not load messages: ${error.message}`, "error");
      }
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 100);
    };

    init();
  }, [router, showToast]);

  const visibleMessages = messages.filter(message => {
    const matchesTab = activeTab === "archived" ? !!message.archived_at : !message.archived_at;
    const matchesSearch = `${message.body ?? ""}`.toLowerCase().includes(searchText.trim().toLowerCase());
    return !message.deleted_at && matchesTab && matchesSearch;
  });

  async function updateOwnMessage(message: Message, action: "archive" | "restore" | "delete") {
    if (!userId || message.sender_id !== userId) return;
    if (action === "delete" && !window.confirm("Delete this message? This cannot be undone.")) return;
    const supabase = createClient();
    const values = action === "delete"
      ? { deleted_at: new Date().toISOString() }
      : { archived_at: action === "archive" ? new Date().toISOString() : null };
    const { error } = await supabase.from("private_messages").update(values).eq("id", message.id);
    if (error) {
      showToast(`Could not ${action} this message: ${error.message}`, "error");
      return;
    }
    setMessages(prev => prev.map(item => item.id === message.id ? { ...item, ...values } : item));
    showToast(action === "restore" ? "Message restored." : action === "delete" ? "Message deleted." : "Message archived.", "success");
  }

  // Realtime subscription for private_messages
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`private_messages:student_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_messages",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setTimeout(() => scrollToBottom(true), 100);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Message;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textBody.trim() || !userId || sending) return;

    setSending(true);
    const supabase = createClient();
    const content = textBody.trim();
    const urgentFlag = isUrgent;

    try {
      // 1. Insert message
      const { data: newMsg, error: msgError } = await supabase
        .from("private_messages")
        .insert({
          student_id: userId,
          sender_id: userId,
          body: content,
          voice_url: null,
          is_urgent: urgentFlag,
          is_read: false,
          is_removed: false,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // 2. If urgent, log it
      if (urgentFlag && newMsg?.id) {
        await supabase.from("urgent_message_logs").insert({
          message_id: newMsg.id,
          student_id: userId,
        });
      }

      // 3. Queue entry: ensure student is in consultation_queue if not active/waiting
      const { data: existingQueue } = await supabase
        .from("consultation_queue")
        .select("id, is_urgent")
        .eq("student_id", userId)
        .in("status", ["waiting", "active"])
        .maybeSingle();

      if (!existingQueue) {
        await supabase.from("consultation_queue").insert({
          student_id: userId,
          status: "waiting",
          is_urgent: urgentFlag,
          entered_at: new Date().toISOString(),
        });
      } else if (urgentFlag && !existingQueue.is_urgent) {
        await supabase
          .from("consultation_queue")
          .update({ is_urgent: true })
          .eq("id", existingQueue.id);
      }

      setTextBody("");
      setIsUrgent(false);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err: unknown) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Handle voice message recording completion
  const handleVoiceRecordingComplete = async (blob: Blob) => {
    if (!userId || sending) return;
    setSending(true);
    const supabase = createClient();
    const urgentFlag = isUrgent;

    try {
      const fileName = `${userId}/${Date.now()}.webm`;

      // Upload to Supabase Storage bucket: voice-messages
      const { error: uploadError } = await supabase.storage
        .from("voice-messages")
        .upload(fileName, blob, {
          contentType: "audio/webm",
          cacheControl: "3600",
          upsert: true,
        });

      let voiceUrl: string | null = null;
      if (!uploadError) {
        // Try signed URL (valid for 7 days)
        const { data: signed } = await supabase.storage
          .from("voice-messages")
          .createSignedUrl(fileName, 60 * 60 * 24 * 7);

        if (signed?.signedUrl) {
          voiceUrl = signed.signedUrl;
        } else {
          const { data: pub } = supabase.storage
            .from("voice-messages")
            .getPublicUrl(fileName);
          voiceUrl = pub.publicUrl;
        }
      }

      if (!voiceUrl) {
        throw new Error("Unable to obtain voice message URL");
      }

      // Insert message with voice_url
      const { data: newMsg, error: msgError } = await supabase
        .from("private_messages")
        .insert({
          student_id: userId,
          sender_id: userId,
          body: textBody.trim() ? textBody.trim() : null,
          voice_url: voiceUrl,
          is_urgent: urgentFlag,
          is_read: false,
          is_removed: false,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // Log urgent if flagged
      if (urgentFlag && newMsg?.id) {
        await supabase.from("urgent_message_logs").insert({
          message_id: newMsg.id,
          student_id: userId,
        });
      }

      // Check/create consultation queue entry
      const { data: existingQueue } = await supabase
        .from("consultation_queue")
        .select("id, is_urgent")
        .eq("student_id", userId)
        .in("status", ["waiting", "active"])
        .maybeSingle();

      if (!existingQueue) {
        await supabase.from("consultation_queue").insert({
          student_id: userId,
          status: "waiting",
          is_urgent: urgentFlag,
          entered_at: new Date().toISOString(),
        });
      } else if (urgentFlag && !existingQueue.is_urgent) {
        await supabase
          .from("consultation_queue")
          .update({ is_urgent: true })
          .eq("id", existingQueue.id);
      }

      setTextBody("");
      setIsUrgent(false);
      setShowVoiceRecorder(false);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err: unknown) {
      console.error("Error uploading voice message:", err);
      alert("Failed to upload voice message. Please check storage bucket or try text.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Navbar role={role} nickname={nickname} avatarId={avatarId} />
      <div className="dashboard-layout">
        <Sidebar role={role} nickname={nickname} avatarId={avatarId} />
        <main className="dashboard-main" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", paddingBottom: "1rem" }}>
          {/* Header */}
          <div
            style={{
              paddingBottom: "1rem",
              borderBottom: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h1 className="section-title" style={{ fontSize: "1.3rem", margin: 0 }}>
                  Guidance Counselor Messages
                </h1>
                <span
                  className={`badge ${
                    counselorStatus === "available"
                      ? "badge-success"
                      : counselorStatus === "in_consultation"
                      ? "badge-danger"
                      : counselorStatus === "away"
                      ? "badge-warning"
                      : "badge-brand"
                  }`}
                  title="Counselor live status"
                >
                  {counselorStatus.replace("_", " ")}
                </span>
              </div>
              <Link href="/student/referrals" className="btn btn-secondary btn-sm">My Referrals</Link>
              <p className="text-muted text-sm" style={{ margin: "0.2rem 0 0" }}>
                Confidential 1-on-1 counseling channel. Messages are private between you and the counselor.
              </p>
            </div>
          </div>

          <div className="message-view-tabs" role="tablist" aria-label="Message views">
            <button type="button" className={`btn btn-sm ${activeTab === "messages" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("messages")}>Messages</button>
            <button type="button" className={`btn btn-sm ${activeTab === "archived" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("archived")}>Archived</button>
          </div>
          <label className="messages-search">
            <span className="sr-only">Search messages</span>
            <input className="form-input" type="search" value={searchText}
              onChange={event => setSearchText(event.target.value)} placeholder="Search your messages" />
          </label>

          {/* Messages list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {loading ? (
              <div className="message-skeleton-list" role="status" aria-busy="true" aria-label="Loading messages">
                <span className="sr-only">Loading messages…</span>
                {[0, 1, 2].map(item => (
                  <div key={item} className={`message-skeleton-row${item % 2 ? " outgoing" : ""}`}>
                    <Skeleton width="38%" height="0.8rem" />
                    <Skeleton width={item % 2 ? "58%" : "72%"} height="3.2rem" />
                  </div>
                ))}
              </div>
            ) : visibleMessages.length === 0 ? (
              <EmptyState icon="message" title={searchText ? "No messages match that search" : activeTab === "archived" ? "No archived messages" : "No messages yet"}
                description={searchText ? "Try another word or clear your search." : "You’re not alone. Send a private message whenever you’re ready."} />
            ) : (
              <div className="messages-list">
                {visibleMessages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div
                      key={msg.id}
                      className={`message-bubble ${isMine ? "mine" : "theirs"}`}
                      style={{
                        position: "relative",
                        border: msg.is_urgent ? "1px solid var(--danger)" : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          marginBottom: "0.35rem",
                        }}
                      >
                        <span className="message-author">
                          {isMine
                            ? "You"
                            : counselorIdentity
                              ? <ProfileIdentity name={counselorIdentity.nickname} role="counselor" position={counselorIdentity.position} />
                              : "Guidance Counselor"}
                        </span>
                        {msg.is_urgent && (
                          <span
                            className="badge badge-danger"
                            style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}
                            title="Urgent Message"
                          >
                            ⚠️ URGENT
                          </span>
                        )}
                      </div>

                      {/* Body text */}
                      {msg.body && (
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {msg.body}
                        </p>
                      )}

                      {/* Voice player */}
                      {msg.voice_url && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <audio
                            controls
                            src={msg.voice_url}
                            style={{ maxWidth: "100%", height: 38 }}
                          >
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      )}

                      {/* Footer: timestamp + TTS */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: isMine ? "flex-end" : "space-between",
                          gap: "0.75rem",
                          marginTop: "0.5rem",
                          paddingTop: "0.35rem",
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {!isMine && msg.body && (
                          <TTSPlayer text={msg.body} />
                        )}

                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: isMine ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {isMine && (
                        <div className="message-actions">
                          {activeTab === "archived" ? (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void updateOwnMessage(msg, "restore")}>Restore</button>
                          ) : (
                            <>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void updateOwnMessage(msg, "archive")}>Archive</button>
                              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void updateOwnMessage(msg, "delete")}>Delete</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Voice recorder popup */}
          {showVoiceRecorder && (
            <div style={{ marginBottom: "1rem" }}>
              <VoiceMessageRecorder
                onRecordingComplete={handleVoiceRecordingComplete}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            aria-label="Direct message input form"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {isUrgent && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(248, 113, 113, 0.12)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.85rem",
                  color: "var(--danger)",
                }}
              >
                <span>⚠️ Message marked as URGENT (prioritized in the counselor inbox)</span>
                <button
                  type="button"
                  onClick={() => setIsUrgent(false)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--danger)", padding: 0 }}
                  title="Remove urgent flag"
                >
                  ✕ Remove
                </button>
              </div>
            )}

            <textarea
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              placeholder="Type your message to the counselor... (Press Shift+Enter for new line)"
              aria-label="Private message text"
              rows={2}
              className="form-textarea"
              style={{
                background: "transparent",
                border: "none",
                padding: "0.25rem 0",
                minHeight: 50,
                resize: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
                paddingTop: "0.4rem",
                borderTop: "1px solid var(--border-light)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {/* Voice button */}
                <button
                  type="button"
                  onClick={() => setShowVoiceRecorder((prev) => !prev)}
                  className={`btn btn-sm ${showVoiceRecorder ? "btn-primary" : "btn-secondary"}`}
                  title={showVoiceRecorder ? "Close voice recorder" : "Record voice message"}
                >
                  <span aria-hidden="true" title="Microphone">
                    🎤
                  </span>
                  <span>{showVoiceRecorder ? "Recording Mode" : "Voice"}</span>
                </button>

                {/* Urgent flag button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isUrgent) {
                      setIsUrgent(false);
                    } else {
                      setShowUrgentDialog(true);
                    }
                  }}
                  className={`btn btn-sm ${isUrgent ? "btn-danger" : "btn-secondary"}`}
                  title="Toggle urgent priority flag"
                >
                  <span aria-hidden="true" title="Urgent warning">
                    ⚠️
                  </span>
                  <span>{isUrgent ? "Urgent Active" : "Mark as Urgent"}</span>
                </button>
              </div>

              {/* Send button */}
              <button
                type="submit"
                disabled={sending || (!textBody.trim() && !isUrgent)}
                className="btn btn-primary btn-sm"
                title="Send message to counselor"
              >
                {sending ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <span aria-hidden="true" title="Send icon">
                      ➤
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Urgent Warning Confirmation Dialog */}
          <UrgentWarningDialog
            isOpen={showUrgentDialog}
            onConfirm={() => {
              setIsUrgent(true);
              setShowUrgentDialog(false);
            }}
            onCancel={() => setShowUrgentDialog(false)}
          />
        </main>
      </div>
    </>
  );
}
