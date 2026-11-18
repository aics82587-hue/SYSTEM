"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { VoiceMessageRecorder } from "@/components/VoiceMessageRecorder";
import { TTSPlayer } from "@/components/TTSPlayer";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import type { AppRole } from "@/lib/identity";
import {
  GroupChatVisibilityPicker,
  ChatMember,
} from "./GroupChatVisibilityPicker";

interface GroupMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  voice_url: string | null;
  visible_to: string[];
  created_at: string;
  sender?: {
    id: string;
    nickname: string;
    role: string;
    position?: string;
  };
}

interface PageProps {
  params: Promise<{ chatId: string }>;
}

export default function StudentGroupChatRoomPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const chatId = resolvedParams.chatId;
  const router = useRouter();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserNickname, setCurrentUserNickname] = useState<string>("");
  const [currentAvatarId, setCurrentAvatarId] = useState("lavender-cat");
  const [currentRole, setCurrentRole] = useState<AppRole>("student");
  const [chatName, setChatName] = useState<string>("");
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);

  // Input states
  const [inputText, setInputText] = useState("");
  const [selectedVisibilityIds, setSelectedVisibilityIds] = useState<string[]>([]);
  const [isVisibilityPickerOpen, setIsVisibilityPickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function initRoom() {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        // 1. Auth check
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, public_name, avatar_id, role, position")
          .eq("id", user.id)
          .single();

        if (!profile || (profile.role !== "student" && profile.role !== "community_member")) {
          router.push("/login");
          return;
        }

        if (!isMounted) return;
        setCurrentUserId(user.id);
        setCurrentUserNickname(profile.public_name);
        setCurrentAvatarId(profile.avatar_id);
        setCurrentRole(profile.role as AppRole);

        // 2. Fetch Group Chat Details
        const { data: chatData, error: chatErr } = await supabase
          .from("group_chats")
          .select("id, name, created_by")
          .eq("id", chatId)
          .single();

        if (chatErr || !chatData) {
          setErrorMsg("Group chat not found or access denied.");
          setIsLoading(false);
          return;
        }

        // 3. Fetch Group Chat Members
        const { data: membersData, error: membersErr } = await supabase
          .from("group_chat_members")
          .select(
            `
            user_id,
            is_counselor,
            profiles (id, public_name, role, position, avatar_id)
          `
          )
          .eq("chat_id", chatId);

        if (membersErr || !membersData) {
          setErrorMsg("Failed to load group chat members.");
          setIsLoading(false);
          return;
        }

        // Verify membership
        const isMember = membersData.some((m) => m.user_id === user.id);
        if (!isMember) {
          setErrorMsg("You are not a member of this group chat.");
          setIsLoading(false);
          return;
        }

        const mappedMembers: ChatMember[] = membersData.map((m) => {
          const prof = m.profiles as unknown as { id: string; public_name: string; role: string; position?: string } | null;
          return {
            user_id: m.user_id,
            is_counselor: m.is_counselor,
            nickname: prof?.public_name ?? (m.is_counselor ? "Counselor" : "Student"),
            role: prof?.role ?? (m.is_counselor ? "counselor" : "student"),
            position: prof?.position,
          };
        });

        if (!isMounted) return;
        setChatName(chatData.name);
        setMembers(mappedMembers);

        // Default visibility: all members selected
        const allIds = mappedMembers.map((m) => m.user_id);
        setSelectedVisibilityIds(allIds);

        // 4. Fetch Existing Messages visible to current user
        const { data: msgsData, error: msgsErr } = await supabase
          .from("group_chat_messages")
          .select(
            `
            id,
            chat_id,
            sender_id,
            body,
            voice_url,
            visible_to,
            created_at,
            sender:profiles!sender_id (id, public_name, role, position)
          `
          )
          .eq("chat_id", chatId)
          .contains("visible_to", [user.id])
          .order("created_at", { ascending: true });

        if (msgsErr) {
          console.error("Error fetching messages:", msgsErr);
        } else if (isMounted && msgsData) {
          const formatted: GroupMessage[] = msgsData.map((m) => ({
            id: m.id,
            chat_id: m.chat_id,
            sender_id: m.sender_id,
            body: m.body,
            voice_url: m.voice_url,
            visible_to: m.visible_to,
            created_at: m.created_at,
            sender: (() => {
              const profile = m.sender as unknown as { id: string; public_name: string; role: string; position?: string } | undefined;
              return profile ? { id: profile.id, nickname: profile.public_name, role: profile.role, position: profile.position } : undefined;
            })(),
          }));
          setMessages(formatted);
        }

        // 5. Setup Supabase Realtime Channel
        const channel = supabase.channel(`group_chat_${chatId}`, {
          config: {
            presence: {
              key: user.id,
            },
          },
        });

        channelRef.current = channel;

        // Presence tracking for online indicators
        channel
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            const onlineIds = Object.keys(state);
            setOnlineUserIds(onlineIds);
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "group_chat_messages",
              filter: `chat_id=eq.${chatId}`,
            },
            async (payload) => {
              const newMsg = payload.new as GroupMessage;

              // Check if visible to current user
              if (newMsg.visible_to && newMsg.visible_to.includes(user.id)) {
                // Fetch sender info if needed
                const { data: senderProfile } = await supabase
                  .from("profiles")
                  .select("id, public_name, role, position")
                  .eq("id", newMsg.sender_id)
                  .single();

                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [
                    ...prev,
                    {
                      ...newMsg,
                      sender: senderProfile ? {
                        id: senderProfile.id,
                        nickname: senderProfile.public_name,
                        role: senderProfile.role,
                        position: senderProfile.position,
                      } : undefined,
                    },
                  ];
                });
              }
            }
          )
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await channel.track({
                user_id: user.id,
                nickname: profile.public_name,
                online_at: new Date().toISOString(),
              });
            }
          });
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Error initializing chat room";
          setErrorMsg(msg);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initRoom();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [chatId, router, supabase]);

  // Visibility calculation & validation
  const counselorIds = members
    .filter((m) => m.is_counselor || m.role === "counselor")
    .map((m) => m.user_id);

  const selectedOtherStudentsCount = members.filter(
    (m) =>
      m.user_id !== currentUserId &&
      !counselorIds.includes(m.user_id) &&
      selectedVisibilityIds.includes(m.user_id)
  ).length;

  const isVisibilityValid = selectedOtherStudentsCount >= 2;

  // Send Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUserId) return;

    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (!isVisibilityValid) {
      setErrorMsg("Please select at least 2 classmates to see this message.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMsg(null);

      // Ensure sender and counselor are always in visible_to
      const finalVisibleTo = Array.from(
        new Set([currentUserId, ...counselorIds, ...selectedVisibilityIds])
      );

      const { error: insertErr } = await supabase
        .from("group_chat_messages")
        .insert({
          chat_id: chatId,
          sender_id: currentUserId,
          body: trimmed,
          visible_to: finalVisibleTo,
        });

      if (insertErr) throw insertErr;

      setInputText("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setErrorMsg(msg);
    } finally {
      setIsSending(false);
    }
  };

  // Send Voice Message
  const handleSendVoice = async (audioBlob: Blob) => {
    if (!currentUserId) return;

    if (!isVisibilityValid) {
      setErrorMsg("Please select at least 2 classmates before sending a voice message.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMsg(null);

      // 1. Upload audio to storage bucket
      const fileName = `${chatId}/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;

      const { error: uploadErr } = await supabase.storage
        .from("voice-messages")
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type || "audio/webm",
          upsert: true,
        });

      let voiceUrl: string | null = null;

      if (!uploadErr) {
        // Try signed URL first
        const { data: signedData } = await supabase.storage
          .from("voice-messages")
          .createSignedUrl(fileName, 60 * 60 * 24 * 365);

        if (signedData?.signedUrl) {
          voiceUrl = signedData.signedUrl;
        } else {
          const { data: pubData } = supabase.storage
            .from("voice-messages")
            .getPublicUrl(fileName);
          voiceUrl = pubData.publicUrl;
        }
      } else {
        // Fallback: convert to base64 Data URL if bucket is unreachable
        voiceUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      // 2. Insert into group_chat_messages
      const finalVisibleTo = Array.from(
        new Set([currentUserId, ...counselorIds, ...selectedVisibilityIds])
      );

      const { error: msgErr } = await supabase
        .from("group_chat_messages")
        .insert({
          chat_id: chatId,
          sender_id: currentUserId,
          voice_url: voiceUrl,
          visible_to: finalVisibleTo,
        });

      if (msgErr) throw msgErr;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send voice message";
      setErrorMsg(msg);
    } finally {
      setIsSending(false);
    }
  };

  // Format visibility note: "Visible to: [nickname1], [nickname2], Counselor"
  const getVisibilityNote = (visibleToIds: string[]) => {
    if (!visibleToIds || visibleToIds.length === 0) return "";
    const names: string[] = [];

    visibleToIds.forEach((id) => {
      if (id === currentUserId) return; // skip self in note
      const member = members.find((m) => m.user_id === id);
      if (member?.is_counselor || member?.role === "counselor") {
        if (!names.includes("Counselor")) names.push("Counselor");
      } else if (member) {
        names.push(member.nickname);
      }
    });

    if (names.length === 0) return "";
    return `Visible to: ${names.join(", ")}`;
  };

  return (
    <>
      <Navbar role={currentRole} nickname={currentUserNickname} avatarId={currentAvatarId} />
      <div className="dashboard-layout">
        <Sidebar role={currentRole} nickname={currentUserNickname} avatarId={currentAvatarId} />
        <main
          className="dashboard-main"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 64px)",
            padding: "1rem 1.5rem",
            overflow: "hidden",
          }}
        >
          {/* Header Bar */}
          <div
            className="card card-sm"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginBottom: "1rem",
              padding: "0.85rem 1.25rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <Link
                href="/student/group-chat"
                className="btn btn-secondary btn-sm"
                title="Back to group chats list"
                aria-label="Back to group chats"
                style={{ padding: "0.35rem 0.65rem" }}
              >
                Group chats
              </Link>
              <div>
                <h1 style={{ fontSize: "1.2rem", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>{chatName || "Group Chat"}</span>
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.2rem" }}>
                  <span className="badge badge-brand" title="Total members">
                    👥 {members.length} members
                  </span>
                  <span
                    className="badge badge-success"
                    title="Active users in this room"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "var(--success)",
                        display: "inline-block",
                      }}
                    />
                    {onlineUserIds.length} online
                  </span>
                </div>
              </div>
            </div>

            {/* Counselor presence indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {members
                .filter((m) => m.is_counselor || m.role === "counselor")
                .map((c) => {
                  const isCounselorOnline = onlineUserIds.includes(c.user_id);
                  return (
                    <span
                      key={c.user_id}
                      className="badge badge-muted"
                      title={isCounselorOnline ? "Counselor is currently online in room" : "Counselor will receive all messages"}
                      style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                    >
                      🛡️ {c.nickname} {isCounselorOnline ? "(Active)" : "(Offline)"}
                    </span>
                  );
                })}
            </div>
          </div>

          {errorMsg && (
            <div className="notice notice-danger mb-1" role="alert" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
              {errorMsg}
            </div>
          )}

          {/* Messages Area */}
          <div
            className="card"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              background: "var(--bg-card)",
            }}
            role="log"
            aria-live="polite"
            aria-label="Group chat message history"
          >
            {isLoading ? (
              <div style={{ textAlign: "center", margin: "auto", color: "var(--text-muted)" }}>
                <div className="spinner" style={{ margin: "0 auto 0.5rem" }} />
                <p>Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state" style={{ margin: "auto", padding: "2rem" }}>
                <div className="empty-state-icon" title="No messages">
                  💬
                </div>
                <h3>No messages yet</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  Say hello to your classmates! Counselor is present for guidance.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_id === currentUserId;
                const senderName =
                  m.sender?.nickname ??
                  members.find((mem) => mem.user_id === m.sender_id)?.nickname ??
                  "Classmate";
                const isCounselor =
                  m.sender?.role === "counselor" ||
                  members.find((mem) => mem.user_id === m.sender_id)?.is_counselor;

                const visibilityNote = isMine ? getVisibilityNote(m.visible_to) : "";

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    {/* Sender nickname above theirs bubble */}
                    {!isMine && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          marginBottom: "0.25rem",
                          marginLeft: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          <ProfileIdentity
                            name={m.sender?.nickname ?? senderName}
                            role={m.sender?.role ?? members.find((member) => member.user_id === m.sender_id)?.role}
                            position={m.sender?.position ?? members.find((member) => member.user_id === m.sender_id)?.position}
                          />
                        </span>
                        {isCounselor && (
                          <span className="badge badge-success" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                            🛡️ Counselor
                          </span>
                        )}
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div
                      className={`message-bubble ${isMine ? "mine" : "theirs"}`}
                      style={{
                        position: "relative",
                        wordBreak: "break-word",
                        maxWidth: "75%",
                      }}
                    >
                      {/* Text content */}
                      {m.body && <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "inherit" }}>{m.body}</p>}

                      {/* Voice player */}
                      {m.voice_url && (
                        <div style={{ marginTop: m.body ? "0.5rem" : 0 }}>
                          <audio
                            src={m.voice_url}
                            controls
                            style={{ height: "34px", maxWidth: "260px" }}
                            aria-label={`Voice message from ${isMine ? "you" : senderName}`}
                          />
                        </div>
                      )}

                      {/* Footer: timestamp + TTS button */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                          marginTop: "0.35rem",
                        }}
                      >
                        {m.body && <TTSPlayer text={m.body} compact={true} />}
                        <span
                          style={{
                            fontSize: "0.72rem",
                            opacity: 0.75,
                            color: isMine ? "rgba(255,255,255,0.8)" : "var(--text-muted)",
                          }}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Visibility note below MY messages */}
                    {isMine && visibilityNote && (
                      <span
                        style={{
                          fontSize: "0.74rem",
                          color: "var(--text-muted)",
                          marginTop: "0.25rem",
                          marginRight: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                        title={visibilityNote}
                      >
                        <span title="Eye icon" role="img" aria-hidden="true">
                          👁️
                        </span>
                        {visibilityNote}
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className="card card-sm"
            style={{
              marginTop: "0.85rem",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-card)",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            {/* Top row: Visibility Selector & Status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsVisibilityPickerOpen(true)}
                  className={`btn btn-sm ${isVisibilityValid ? "btn-secondary" : "btn-danger"}`}
                  title="Configure who sees your next message"
                  aria-label="Open message visibility settings"
                  style={{
                    padding: "0.3rem 0.75rem",
                    fontSize: "0.8rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span title="Visibility settings" role="img" aria-hidden="true">
                    👁️
                  </span>
                  <span>
                    Visible to: {selectedOtherStudentsCount} classmate{selectedOtherStudentsCount === 1 ? "" : "s"} + Counselor
                  </span>
                </button>

                {!isVisibilityValid && (
                  <span style={{ fontSize: "0.78rem", color: "var(--danger)", fontWeight: 500 }}>
                    Select at least 2 classmates
                  </span>
                )}
              </div>

              {/* Voice Recorder control */}
              <VoiceMessageRecorder onSend={handleSendVoice} disabled={isSending || !isVisibilityValid} />
            </div>

            {/* Bottom row: Textarea & Send button */}
            <form
              onSubmit={handleSendMessage}
              style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}
              aria-label="Send group chat message form"
            >
              <textarea
                className="form-textarea"
                placeholder={
                  isVisibilityValid
                    ? "Type your message to the group... (Press Enter to send)"
                    : "Select at least 2 classmates to enable messaging..."
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isSending || !isVisibilityValid}
                rows={2}
                style={{
                  minHeight: "44px",
                  maxHeight: "120px",
                  padding: "0.6rem 0.85rem",
                  fontSize: "0.92rem",
                  flex: 1,
                  resize: "none",
                }}
                aria-label="Group chat message text"
              />

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSending || !inputText.trim() || !isVisibilityValid}
                title="Send message"
                aria-label="Send message"
                style={{ height: "44px", padding: "0 1.25rem" }}
              >
                {isSending ? (
                  <div className="spinner" style={{ width: "16px", height: "16px" }} />
                ) : (
                  <>
                    <span title="Send arrow" role="img" aria-hidden="true">
                      ➤
                    </span>
                    Send
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Visibility Picker Modal */}
          <GroupChatVisibilityPicker
            members={members}
            currentUserId={currentUserId || ""}
            selectedIds={selectedVisibilityIds}
            onChange={(newIds) => setSelectedVisibilityIds(newIds)}
            isOpen={isVisibilityPickerOpen}
            onClose={() => setIsVisibilityPickerOpen(false)}
          />
        </main>
      </div>
    </>
  );
}
