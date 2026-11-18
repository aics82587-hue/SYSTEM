"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { VoiceMessageRecorder } from "@/components/VoiceMessageRecorder";
import { TTSPlayer } from "@/components/TTSPlayer";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import { useToast } from "@/components/ToastProvider";
import { ReferralButton } from "@/components/ReferralButton";

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

interface StudentProfile {
  id: string;
  public_name: string;
}

interface Conversation {
  studentId: string;
  studentNickname: string;
  messages: Message[];
  lastMessage: Message;
  firstMessageCreatedAt: string;
  hasUrgent: boolean;
  unreadCount: number;
  flagColor: "yellow" | "orange" | "red" | null;
  isRemoved: boolean;
}

const FLAG_CONFIGS = {
  yellow: { label: "Slightly off-topic", icon: "🟡", badgeClass: "badge-warning" },
  orange: { label: "Moderately irrelevant", icon: "🟠", badgeClass: "badge-warning" },
  red: { label: "Completely inappropriate/nonsense", icon: "🔴", badgeClass: "badge-danger" },
};

export default function CounselorMessagesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [counselorId, setCounselorId] = useState<string | null>(null);
  const [counselorNickname, setCounselorNickname] = useState<string>("");
  const [counselorPosition, setCounselorPosition] = useState("Guidance Counselor");
  const [counselorAvatarId, setCounselorAvatarId] = useState("lavender-cat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Active chat state
  const [replyText, setReplyText] = useState("");
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [sending, setSending] = useState(false);
  const [openFlagMenuStudentId, setOpenFlagMenuStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "ignored" | "archived">("inbox");
  const [searchText, setSearchText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  // 1. Initial auth and data loading
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
        .select("public_name, role, position, avatar_id")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "counselor") {
        router.push("/login");
        return;
      }

      setCounselorId(user.id);
      setCounselorNickname(profile?.public_name ?? "Counselor");
      setCounselorPosition(profile?.position ?? "Guidance Counselor");
      setCounselorAvatarId(profile?.avatar_id ?? "lavender-cat");

      // Fetch all private messages
      const { data: msgs } = await supabase
        .from("private_messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (msgs) {
        setMessages(msgs as Message[]);

        // Extract student IDs and fetch nicknames
        const studentIds = Array.from(new Set(msgs.map((m: Message) => m.student_id)));
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, public_name")
            .in("id", studentIds);

          if (profiles) {
            const map: Record<string, string> = {};
            profiles.forEach((p: StudentProfile) => {
              map[p.id] = p.public_name;
            });
            setProfilesMap(map);
          }
        }
      }

      setLoading(false);
    };

    init();
  }, [router]);

  // 2. Realtime subscription for counselor
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("counselor_private_messages_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_messages" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Fetch nickname if not known yet
            setProfilesMap((prev) => {
              if (!prev[newMsg.student_id]) {
                supabase
                  .from("profiles")
                  .select("id, public_name")
                  .eq("id", newMsg.student_id)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      setProfilesMap((m) => ({ ...m, [data.id]: data.public_name }));
                    }
                  });
              }
              return prev;
            });

            if (selectedStudentId === newMsg.student_id) {
              setTimeout(() => scrollToBottom(true), 100);
            }
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
  }, [selectedStudentId]);

  // 3. Group messages into conversations
  const conversations: Conversation[] = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    messages.forEach((m) => {
      if (!groups[m.student_id]) groups[m.student_id] = [];
      groups[m.student_id].push(m);
    });

    const result = Object.keys(groups).map((studentId) => {
      const studentMsgs = groups[studentId].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const visibleMsgs = studentMsgs.filter(m => !m.deleted_at);
      if (!visibleMsgs.length) return null;
      const lastMessage = visibleMsgs[visibleMsgs.length - 1];
      const firstMessage = visibleMsgs[0];

      // Any active urgent message
      const hasUrgent = studentMsgs.some(
        (m) => !m.deleted_at && m.is_urgent && !m.urgent_acknowledged && !m.is_removed
      );

      // Unread count (messages sent by student that are not read)
      const unreadCount = studentMsgs.filter(
        (m) => !m.deleted_at && !m.is_read && m.sender_id === studentId
      ).length;

      // Flag color (check if any message has flag)
      const flaggedMsg = visibleMsgs.slice().reverse().find((m) => m.flag_color);
      const flagColor = flaggedMsg?.flag_color ?? null;

      // Is conversation removed (all messages removed or last message removed)
      const isRemoved = studentMsgs.some((m) => m.is_removed);

      return {
        studentId,
        studentNickname: profilesMap[studentId] ?? `Student #${studentId.slice(0, 5)}`,
        messages: visibleMsgs,
        lastMessage,
        firstMessageCreatedAt: firstMessage.created_at,
        hasUrgent,
        unreadCount,
        flagColor,
        isRemoved,
      };
    }).filter((conversation): conversation is Conversation => conversation !== null);

    // Sort: Urgent FIRST, then FIFO by oldest firstMessageCreatedAt
    result.sort((a, b) => {
      if (a.hasUrgent && !b.hasUrgent) return -1;
      if (!a.hasUrgent && b.hasUrgent) return 1;
      return new Date(a.firstMessageCreatedAt).getTime() - new Date(b.firstMessageCreatedAt).getTime();
    });

    return result;
  }, [messages, profilesMap]);

  const activeConversations = useMemo(
    () => conversations.filter((c) => {
      if (activeTab === "ignored") return c.isRemoved;
      if (activeTab === "archived") return c.messages.some(message => !!message.archived_at);
      return !c.isRemoved && c.messages.some(message => !message.archived_at);
    }),
    [conversations, activeTab]
  );
  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return activeConversations;
    return activeConversations.filter(conversation =>
      conversation.studentNickname.toLowerCase().includes(query) ||
      conversation.messages.some(message => (message.body ?? "").toLowerCase().includes(query))
    );
  }, [activeConversations, searchText]);

  async function updateMessage(message: Message, action: "archive" | "restore" | "delete") {
    if (action === "delete" && !window.confirm("Delete this message? This cannot be undone.")) return;
    const values = action === "delete"
      ? { deleted_at: new Date().toISOString() }
      : { archived_at: action === "archive" ? new Date().toISOString() : null };
    const { error } = await createClient().from("private_messages").update(values).eq("id", message.id);
    if (error) {
      showToast(`Could not ${action} message: ${error.message}`, "error");
      return;
    }
    setMessages(prev => prev.map(item => item.id === message.id ? { ...item, ...values } : item));
    showToast(action === "restore" ? "Message restored." : action === "delete" ? "Message deleted." : "Message archived.", "success");
  }

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.studentId === selectedStudentId) ?? null,
    [conversations, selectedStudentId]
  );

  // 4. Mark conversation as read when opened
  useEffect(() => {
    if (!selectedStudentId || !counselorId) return;

    const markAsRead = async () => {
      const supabase = createClient();
      await supabase
        .from("private_messages")
        .update({ is_read: true })
        .eq("student_id", selectedStudentId)
        .eq("is_read", false)
        .neq("sender_id", counselorId);

      setMessages((prev) =>
        prev.map((m) =>
          m.student_id === selectedStudentId && m.sender_id !== counselorId
            ? { ...m, is_read: true }
            : m
        )
      );
    };

    markAsRead();
    setTimeout(() => scrollToBottom(false), 100);
  }, [selectedStudentId, counselorId]);

  // 5. Send Counselor Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedStudentId || !counselorId || sending) return;

    setSending(true);
    const supabase = createClient();
    const content = replyText.trim();

    try {
      const { error } = await supabase.from("private_messages").insert({
        student_id: selectedStudentId,
        sender_id: counselorId,
        body: content,
        voice_url: null,
        is_urgent: false,
        is_read: false,
        is_removed: false,
      });

      if (error) throw error;

      // Update consultation queue to active or keep active
      await supabase
        .from("consultation_queue")
        .update({ status: "active", counselor_id: counselorId })
        .eq("student_id", selectedStudentId)
        .eq("status", "waiting");

      setReplyText("");
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err: unknown) {
      console.error("Error replying to student:", err);
      alert("Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // 6. Send Counselor Voice Reply
  const handleVoiceRecordingComplete = async (blob: Blob) => {
    if (!selectedStudentId || !counselorId || sending) return;
    setSending(true);
    const supabase = createClient();

    try {
      const fileName = `counselor/${selectedStudentId}_${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("voice-messages")
        .upload(fileName, blob, {
          contentType: "audio/webm",
          cacheControl: "3600",
          upsert: true,
        });

      let voiceUrl: string | null = null;
      if (!uploadError) {
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

      if (!voiceUrl) throw new Error("Could not get voice message URL");

      const { error } = await supabase.from("private_messages").insert({
        student_id: selectedStudentId,
        sender_id: counselorId,
        body: replyText.trim() ? replyText.trim() : null,
        voice_url: voiceUrl,
        is_urgent: false,
        is_read: false,
        is_removed: false,
      });

      if (error) throw error;

      setReplyText("");
      setShowVoiceRecorder(false);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err: unknown) {
      console.error("Error uploading voice message:", err);
      alert("Failed to send voice message. Please check storage bucket or try text.");
    } finally {
      setSending(false);
    }
  };

  // 7. Flag Conversation / Messages
  const handleApplyFlag = async (studentId: string, color: "yellow" | "orange" | "red" | null) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("private_messages")
        .update({ flag_color: color })
        .eq("student_id", studentId);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) => (m.student_id === studentId ? { ...m, flag_color: color } : m))
      );
      setOpenFlagMenuStudentId(null);
    } catch (err) {
      console.error("Error setting flag:", err);
    }
  };

  // 8. Ignore / Remove Conversation
  const handleIgnoreConversation = async (studentId: string) => {
    if (
      !confirm(
        "Are you sure you want to ignore this conversation? It will be removed from your active inbox."
      )
    ) {
      return;
    }

    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("private_messages")
        .update({ is_removed: true })
        .eq("student_id", studentId)
        .eq("sender_id", studentId);

      if (error) throw error;

      // Also mark queue entry resolved
      await supabase
        .from("consultation_queue")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("student_id", studentId)
        .in("status", ["waiting", "active"]);

      setMessages((prev) =>
        prev.map((m) => (m.student_id === studentId ? { ...m, is_removed: true } : m))
      );

      if (selectedStudentId === studentId) {
        setSelectedStudentId(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not ignore conversation.", "error");
    }
  };

  // 9. Mark Queue Status Done
  const handleCompleteConsultation = async (studentId: string) => {
    const supabase = createClient();
    try {
      await supabase
        .from("consultation_queue")
        .update({ status: "done", resolved_at: new Date().toISOString() })
        .eq("student_id", studentId)
        .in("status", ["waiting", "active"]);

      alert("Consultation marked as completed.");
    } catch (err) {
      console.error("Error marking consultation done:", err);
    }
  };

  return (
    <>
      <Navbar role="counselor" nickname={counselorNickname} avatarId={counselorAvatarId} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={counselorNickname} avatarId={counselorAvatarId} />
        <main
          className="dashboard-main"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 64px)",
            padding: "1rem",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <h1 className="section-title" style={{ fontSize: "1.3rem", margin: 0 }}>
                Messages
              </h1>
              <p className="text-muted text-sm" style={{ margin: "0.15rem 0 0" }}>
                Urgent messages are prioritized, followed by oldest first.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setActiveTab("inbox")}
                className={`btn btn-sm ${activeTab === "inbox" ? "btn-primary" : "btn-secondary"}`}
                title="Active inquiries"
              >
                Inbox ({conversations.filter((c) => !c.isRemoved).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("archived")}
                className={`btn btn-sm ${activeTab === "archived" ? "btn-primary" : "btn-secondary"}`}
                title="Archived unanswered messages"
              >
                Archived ({conversations.reduce((count, conv) => count + conv.messages.filter(message => !!message.archived_at).length, 0)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ignored")}
                className={`btn btn-sm ${activeTab === "ignored" ? "btn-primary" : "btn-secondary"}`}
                title="Ignored conversations"
              >
                Ignored ({conversations.filter((c) => c.isRemoved).length})
              </button>
            </div>
          </div>

          {/* Master-Detail Container */}
          <div
            className="messages-master-detail"
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: selectedStudentId ? "360px 1fr" : "1fr",
              gridTemplateRows: selectedStudentId ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
              gap: "1rem",
              minHeight: 0,
              paddingTop: "0.75rem",
            }}
          >
            {/* Conversations List Panel */}
            <div
              style={{
                display: selectedStudentId ? "flex" : "flex",
                flexDirection: "column",
                gap: "0.5rem",
                overflowY: "auto",
                paddingRight: "0.35rem",
              }}
            >
              <label className="messages-search">
                <span className="sr-only">Search inbox</span>
                <input className="form-input" type="search" value={searchText}
                  onChange={event => setSearchText(event.target.value)} placeholder="Search students or messages" />
              </label>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                  <div className="spinner" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon" title="Inbox empty" aria-hidden="true">
                    📬
                  </div>
                  <h3>{searchText ? "No matches found" : `No ${activeTab} messages`}</h3>
                  <p className="text-muted text-sm">
                    {searchText
                      ? "Try another search or clear the search field."
                      : activeTab === "inbox"
                      ? "When students send private messages, they will appear here in waiting order."
                      : activeTab === "ignored" ? "No ignored conversations." : "No archived messages."}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = selectedStudentId === conv.studentId;
                  const isFlagMenuOpen = openFlagMenuStudentId === conv.studentId;

                  return (
                    <div
                      key={conv.studentId}
                      style={{
                        position: "relative",
                        background: isSelected ? "var(--bg-elevated)" : "var(--bg-card)",
                        border: `1px solid ${
                          conv.hasUrgent
                            ? "var(--danger)"
                            : isSelected
                            ? "var(--brand)"
                            : "var(--border-light)"
                        }`,
                        borderRadius: "var(--radius-md)",
                        padding: "0.9rem 1rem",
                        cursor: "pointer",
                        transition: "all var(--transition)",
                        boxShadow: conv.hasUrgent
                          ? "0 0 12px rgba(248, 113, 113, 0.2)"
                          : "none",
                      }}
                      onClick={() => setSelectedStudentId(conv.studentId)}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "0.3rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              fontSize: "0.95rem",
                            }}
                          >
                            {conv.studentNickname}
                          </span>
                          {conv.hasUrgent && (
                            <span
                              className="badge badge-danger"
                              title="Urgent inquiry needs immediate review"
                            >
                              ⚠️ URGENT
                            </span>
                          )}
                          {conv.unreadCount > 0 && (
                            <span
                              className="badge badge-brand"
                              title={`${conv.unreadCount} unread message(s)`}
                            >
                              {conv.unreadCount} new
                            </span>
                          )}
                          <span className={`badge ${activeTab === "archived" ? "badge-muted" : conv.lastMessage.sender_id === counselorId ? "badge-success" : "badge-warning"}`}>
                            {activeTab === "archived" ? "Archived" : conv.lastMessage.sender_id === counselorId ? "Replied" : conv.unreadCount > 0 ? "New" : "Waiting"}
                          </span>
                        </div>

                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(conv.lastMessage.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Message preview snippet */}
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.85rem",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {conv.lastMessage.body ||
                          (conv.lastMessage.voice_url ? "🎤 [Voice Message]" : "")}
                      </p>

                      {/* Flag display & Actions bar */}
                      <div
                        style={{
                          marginTop: "0.6rem",
                          paddingTop: "0.4rem",
                          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          {conv.flagColor && (
                            <span
                              className={`badge ${FLAG_CONFIGS[conv.flagColor].badgeClass}`}
                              style={{ fontSize: "0.7rem" }}
                              title={`Flagged: ${FLAG_CONFIGS[conv.flagColor].label}`}
                            >
                              {FLAG_CONFIGS[conv.flagColor].icon}{" "}
                              {FLAG_CONFIGS[conv.flagColor].label}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {/* Flag dropdown button */}
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenFlagMenuStudentId(isFlagMenuOpen ? null : conv.studentId)
                              }
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "0.15rem 0.4rem", fontSize: "0.82rem" }}
                              title="Flag conversation topic relevance"
                            >
                              🚩 Flag
                            </button>

                            {isFlagMenuOpen && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  bottom: "100%",
                                  marginBottom: "0.4rem",
                                  background: "var(--bg-elevated)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-md)",
                                  padding: "0.4rem",
                                  zIndex: 100,
                                  minWidth: 200,
                                  boxShadow: "var(--shadow-md)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.2rem",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--text-muted)",
                                    padding: "0.2rem 0.5rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  Flag Reason
                                </span>
                                {(["yellow", "orange", "red"] as const).map((col) => (
                                  <button
                                    key={col}
                                    type="button"
                                    onClick={() => handleApplyFlag(conv.studentId, col)}
                                    className="btn btn-ghost btn-sm"
                                    style={{
                                      justifyContent: "flex-start",
                                      padding: "0.35rem 0.5rem",
                                      fontSize: "0.8rem",
                                      textAlign: "left",
                                    }}
                                  >
                                    <span>{FLAG_CONFIGS[col].icon}</span>
                                    <span>{FLAG_CONFIGS[col].label}</span>
                                  </button>
                                ))}
                                {conv.flagColor && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyFlag(conv.studentId, null)}
                                    className="btn btn-ghost btn-sm"
                                    style={{
                                      justifyContent: "flex-start",
                                      padding: "0.35rem 0.5rem",
                                      fontSize: "0.78rem",
                                      color: "var(--danger)",
                                    }}
                                  >
                                    Clear Flag
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Ignore button */}
                          <button
                            type="button"
                            onClick={() => handleIgnoreConversation(conv.studentId)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: "0.15rem 0.4rem",
                              fontSize: "0.82rem",
                              color: "var(--danger)",
                            }}
                            title="Ignore and remove from active list"
                          >
                            🗑 Ignore
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Conversation Detail View */}
            {selectedConversation ? (
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  height: "100%",
                }}
              >
                {/* Conversation Header */}
                <div
                  style={{
                    padding: "0.9rem 1.25rem",
                    borderBottom: "1px solid var(--border-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(null)}
                      className="btn btn-ghost btn-sm"
                      title="Back to conversations list"
                    >
                      ←
                    </button>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <h2
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            margin: 0,
                          }}
                        >
                          {selectedConversation.studentNickname}
                        </h2>
                        {selectedConversation.hasUrgent && (
                          <span className="badge badge-danger">URGENT</span>
                        )}
                        {selectedConversation.flagColor && (
                          <span
                            className={`badge ${
                              FLAG_CONFIGS[selectedConversation.flagColor].badgeClass
                            }`}
                          >
                            {FLAG_CONFIGS[selectedConversation.flagColor].icon}{" "}
                            {FLAG_CONFIGS[selectedConversation.flagColor].label}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Student pen name
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <ReferralButton studentId={selectedConversation.studentId} />
                    <button
                      type="button"
                      onClick={() => handleCompleteConsultation(selectedConversation.studentId)}
                      className="btn btn-secondary btn-sm"
                      title="Mark consultation completed"
                    >
                      ✓ Complete Session
                    </button>
                  </div>
                </div>

                {/* Messages Chat Area */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div className="messages-list">
                    {selectedConversation.messages.filter(message =>
                      activeTab === "archived" ? !!message.archived_at : !message.archived_at
                    ).map((msg) => {
                      const isMine = msg.sender_id === counselorId;
                      const isLongText = msg.body && msg.body.length > 100;
                      const unansweredStudentMessage = msg.sender_id === selectedConversation.studentId
                        && !selectedConversation.messages.some(reply =>
                          reply.sender_id === counselorId && new Date(reply.created_at) > new Date(msg.created_at)
                        );

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
                              gap: "0.5rem",
                              marginBottom: "0.25rem",
                            }}
                          >
                            <span className="message-author">
                              {isMine
                                ? <ProfileIdentity name={counselorNickname} role="counselor" position={counselorPosition} />
                                : selectedConversation.studentNickname}
                            </span>
                            {msg.is_urgent && (
                              <span
                                className="badge badge-danger"
                                style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}
                              >
                                ⚠️ URGENT
                              </span>
                            )}
                          </div>

                          {/* Body */}
                          {msg.body && (
                            <p
                              style={{
                                margin: 0,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {msg.body}
                            </p>
                          )}

                          {/* Voice playback */}
                          {msg.voice_url && (
                            <div style={{ marginTop: "0.5rem" }}>
                              <audio
                                controls
                                src={msg.voice_url}
                                style={{ maxWidth: "100%", height: 38 }}
                              >
                                Audio playback unsupported.
                              </audio>
                            </div>
                          )}

                          {/* Footer with timestamp + TTS for long messages */}
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
                            {/* TTS button on long messages (>100 chars) */}
                            {isLongText && msg.body && (
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
                          {!isMine && (msg.archived_at || unansweredStudentMessage) && (
                            <div className="message-actions">
                              {activeTab === "archived" ? (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void updateMessage(msg, "restore")}>Restore</button>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void updateMessage(msg, "archive")}>Archive</button>
                                  <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void updateMessage(msg, "delete")}>Delete</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Voice recorder popup */}
                {showVoiceRecorder && (
                  <div style={{ padding: "0.75rem 1.25rem" }}>
                    <VoiceMessageRecorder
                      onRecordingComplete={handleVoiceRecordingComplete}
                      onCancel={() => setShowVoiceRecorder(false)}
                    />
                  </div>
                )}

                {/* Counselor Reply Input */}
                <form
                  onSubmit={handleSendReply}
                  aria-label="Counselor reply form"
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderTop: "1px solid var(--border-light)",
                    background: "var(--bg-elevated)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${selectedConversation.studentNickname}... (Press Shift+Enter for new line)`}
                    aria-label={`Reply to ${selectedConversation.studentNickname}`}
                    rows={2}
                    className="form-textarea"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "0.25rem 0",
                      minHeight: 48,
                      resize: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply(e);
                      }
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "0.4rem",
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowVoiceRecorder((prev) => !prev)}
                      className={`btn btn-sm ${
                        showVoiceRecorder ? "btn-primary" : "btn-secondary"
                      }`}
                      title="Record and send voice response"
                    >
                      <span aria-hidden="true">🎤</span>
                      <span>{showVoiceRecorder ? "Recording Mode" : "Voice Reply"}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="btn btn-primary btn-sm"
                      title="Send response to student"
                    >
                      {sending ? (
                        <>
                          <span className="spinner" style={{ width: 14, height: 14 }} />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Reply</span>
                          <span aria-hidden="true">➤</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div
                className="messages-empty-selection"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="empty-state">
                  <div className="empty-state-icon" title="Select chat" aria-hidden="true">
                    💬
                  </div>
                  <h3>Select a conversation</h3>
                  <p className="text-muted text-sm">
                    Choose a student inquiry from the inbox to read and respond.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
