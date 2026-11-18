import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { CreateChatButton } from "./CreateChatButton";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import { FeatureIcon } from "@/components/FeatureIcon";
import type { AppRole } from "@/lib/identity";

interface MemberWithProfile {
  user_id: string;
  is_counselor: boolean;
  profiles: {
    id: string;
    public_name: string;
    role: string;
    position?: string;
    avatar_id?: string;
  } | null;
}

interface GroupChatRecord {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  group_chat_members: MemberWithProfile[];
}

export default async function StudentGroupChatListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, public_name, avatar_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "student" && profile?.role !== "community_member") redirect("/login");
  const role = profile.role as AppRole;

  // Fetch all group chats this student is a member of
  const { data: chatsData } = await supabase
    .from("group_chats")
    .select(
      `
      id,
      name,
      created_by,
      created_at,
      group_chat_members (
        user_id,
        is_counselor,
        profiles (id, public_name, role, position, avatar_id)
      )
    `
    )
    .order("created_at", { ascending: false });

  const chats = (chatsData as unknown as GroupChatRecord[]) || [];
  const chatIds = chats.map((c) => c.id);

  // Fetch latest message visible to this student in each chat
  const latestMessageMap: Record<
    string,
    {
      body: string | null;
      voice_url: string | null;
      created_at: string;
      sender_nickname?: string;
      sender_role?: string;
      sender_position?: string;
    }
  > = {};

  if (chatIds.length > 0) {
    const { data: msgs } = await supabase
      .from("group_chat_messages")
      .select("id, chat_id, body, voice_url, created_at, profiles:sender_id(public_name, role, position)")
      .in("chat_id", chatIds)
      .contains("visible_to", [user.id])
      .order("created_at", { ascending: false });

    if (msgs) {
      for (const m of msgs) {
        if (!latestMessageMap[m.chat_id]) {
          const senderObj = m.profiles as unknown as { public_name?: string; role?: string; position?: string } | null;
          latestMessageMap[m.chat_id] = {
            body: m.body,
            voice_url: m.voice_url,
            created_at: m.created_at,
            sender_nickname: senderObj?.public_name,
            sender_role: senderObj?.role,
            sender_position: senderObj?.position,
          };
        }
      }
    }
  }

  return (
    <>
      <Navbar role={role} nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role={role} nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          {/* Header */}
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span title="Group chat icon" role="img" aria-hidden="true">
                  👥
                </span>
                Group Chats
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Connect and share support in counselor-guided group discussions.
              </p>
            </div>
            <CreateChatButton currentUserId={user.id} />
          </div>

          {/* Group Chats List or Empty State */}
          {chats.length === 0 ? (
            <div className="card empty-state" style={{ padding: "4rem 2rem" }}>
              <div className="empty-state-icon" title="No group chats">
                💬
              </div>
              <h3>No group chats yet</h3>
              <p style={{ maxWidth: "420px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Create a new group chat with at least 2 classmates. Your guidance counselor will automatically be included to ensure a safe and supportive space.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <CreateChatButton currentUserId={user.id} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {chats.map((chat) => {
                const members = chat.group_chat_members || [];
                const counselorMember = members.find((m) => m.is_counselor);
                const studentMembers = members.filter((m) => !m.is_counselor);
                const latestMsg = latestMessageMap[chat.id];

                return (
                  <Link
                    key={chat.id}
                    href={`/student/group-chat/${chat.id}`}
                    className="thread-item"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid var(--border)",
                      transition: "all var(--transition)",
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: "rgba(var(--brand-rgb),0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--brand-light)",
                          }}
                          title="Group icon"
                        >
                          <FeatureIcon name="users" size={20} />
                        </span>
                        <div>
                          <h3 className="thread-title" style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>
                            {chat.name}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span className="badge badge-brand" title="Student member count">
                              {studentMembers.length} Student{studentMembers.length === 1 ? "" : "s"}
                            </span>
                            {counselorMember && (
                              <span className="badge badge-success" title="Counselor included">
                                🛡️ <ProfileIdentity
                                  name={counselorMember.profiles?.public_name ?? "Counselor"}
                                  avatarId={counselorMember.profiles?.avatar_id}
                                  role="counselor"
                                  position={counselorMember.profiles?.position}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                          {latestMsg
                            ? new Date(latestMsg.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : new Date(chat.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                        </span>
                      </div>
                    </div>

                    {/* Preview of latest message */}
                    <div
                      style={{
                        marginTop: "0.5rem",
                        padding: "0.6rem 0.9rem",
                        background: "var(--bg-elevated)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "0.88rem",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {latestMsg ? (
                        <>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {latestMsg.sender_nickname ? (
                              <><ProfileIdentity name={latestMsg.sender_nickname} role={latestMsg.sender_role} position={latestMsg.sender_position} />:</>
                            ) : ""}
                          </span>
                          {latestMsg.voice_url ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "var(--brand-light)" }}>
                              <span title="Voice message" role="img" aria-hidden="true">
                                🎤
                              </span>
                              Voice Message
                            </span>
                          ) : (
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "550px",
                              }}
                            >
                              {latestMsg.body}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted" style={{ fontStyle: "italic" }}>
                          No messages yet. Click to start the conversation!
                        </span>
                      )}
                    </div>
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
