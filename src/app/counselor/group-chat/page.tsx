import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import { FeatureIcon } from "@/components/FeatureIcon";

interface MemberRecord {
  user_id: string;
  is_counselor: boolean;
  profiles: {
    id: string;
    public_name: string;
    role: string;
    position?: string;
  } | null;
}

interface GroupChatRecord {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  group_chat_members: MemberRecord[];
}

export default async function CounselorGroupChatsPage() {
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

  if (profile?.role !== "counselor") redirect("/login");

  // Counselor sees ALL group chats (she is a member of all via is_counselor=true)
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

  // Fetch latest messages across all chats
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
      <Navbar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          {/* Header */}
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span title="Counselor Group Chat Oversight" role="img" aria-hidden="true">
                  👥
                </span>
                Student Group Chats
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Monitor and participate in student group conversations. You are auto-enrolled in all circles for safety and support.
              </p>
            </div>
            <span className="badge badge-success" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
              🛡️ Counselor Oversight Active
            </span>
          </div>

          {/* Group Chats List or Empty State */}
          {chats.length === 0 ? (
            <div className="card empty-state" style={{ padding: "4rem 2rem" }}>
              <div className="empty-state-icon" title="No group chats">
                💬
              </div>
              <h3>No student group chats yet</h3>
              <p style={{ maxWidth: "450px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                When students form support groups or discussion circles, they will automatically appear here with your presence attached.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {chats.map((chat) => {
                const members = chat.group_chat_members || [];
                const studentMembers = members.filter((m) => !m.is_counselor && m.profiles?.role === "student");
                const latestMsg = latestMessageMap[chat.id];

                return (
                  <Link
                    key={chat.id}
                    href={`/counselor/group-chat/${chat.id}`}
                    className="thread-item"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid var(--border)",
                      transition: "all var(--transition)",
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <span
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "50%",
                            background: "rgba(var(--brand-rgb),0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--brand-light)",
                          }}
                          title="Group chat"
                        >
                          <FeatureIcon name="users" size={20} />
                        </span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <h3 className="thread-title" style={{ fontSize: "1.1rem", margin: 0 }}>
                              {chat.name}
                            </h3>
                            <span className="badge badge-brand">
                              {studentMembers.length} Student{studentMembers.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          {/* Student Nicknames List */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Members:</span>
                            {studentMembers.map((sm) => (
                              <span
                                key={sm.user_id}
                                className="badge badge-muted"
                                style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
                                title={`Student: ${sm.profiles?.public_name ?? "Anonymous"}`}
                              >
                                {sm.profiles?.public_name ?? "Student"}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                          {latestMsg
                            ? `Last activity: ${new Date(latestMsg.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : `Created: ${new Date(chat.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}`}
                        </span>
                      </div>
                    </div>

                    {/* Latest Message Preview */}
                    <div
                      style={{
                        marginTop: "0.6rem",
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
                            ) : "Participant:"}
                          </span>
                          {latestMsg.voice_url ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "var(--brand-light)" }}>
                              <span title="Voice recording" role="img" aria-hidden="true">
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
                          No messages sent in this circle yet.
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
