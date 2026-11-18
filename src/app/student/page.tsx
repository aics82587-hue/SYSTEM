import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { CounselorStatusBanner } from "@/components/CounselorStatusBanner";
import { PageHeader } from "@/components/PageHeader";
import { DashboardFeatureCard } from "@/components/DashboardFeatureCard";
import { getGreeting } from "@/lib/greeting";
import Link from "next/link";

export const metadata = {
  title: "Student Dashboard | Mentalks",
};

export default async function StudentDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("public_name, pen_name, avatar_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "student") redirect("/login");

  // 1. Fetch counselor profile and status
  const { data: counselorProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "counselor")
    .limit(1)
    .maybeSingle();

  let initialStatus: string | null = "available";
  let initialReason: string | null = null;
  if (counselorProfile) {
    const { data: statusRow } = await supabase
      .from("counselor_status")
      .select("status, reason")
      .eq("counselor_id", counselorProfile.id)
      .maybeSingle();

    if (statusRow) {
      initialStatus = statusRow.status;
      initialReason = statusRow.reason;
    }
  }

  // 2. Fetch queue counts
  const { count: waitingCount } = await supabase
    .from("consultation_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "waiting");

  // 3. Fetch student's own queue entry
  const { data: myQueue } = await supabase
    .from("consultation_queue")
    .select("id, status, is_urgent, position, entered_at")
    .eq("student_id", user.id)
    .in("status", ["waiting", "active"])
    .order("entered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let positionInLine: number | null = myQueue?.position ?? null;
  if (myQueue && myQueue.status === "waiting" && !positionInLine && myQueue.entered_at) {
    const { count: aheadCount } = await supabase
      .from("consultation_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting")
      .lte("entered_at", myQueue.entered_at);

    positionInLine = aheadCount || 1;
  }

  // 4. Fetch threads & appointments
  const { data: threads } = await supabase
    .from("threads")
    .select("id, title, visibility, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, requested_at, status")
    .eq("student_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(3);

  const { count: pendingReferrals } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("student_id", user.id)
    .in("status", ["sent", "seen", "scheduled"]);

  return (
    <>
      <Navbar role="student" nickname={profile?.public_name} avatarId={profile?.avatar_id} showBack={false} />
      <div className="dashboard-layout">
        <Sidebar role="student" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          {/* Top Counselor Status Banner */}
          <CounselorStatusBanner
            initialStatus={initialStatus}
            initialReason={initialReason}
            initialQueueCount={waitingCount ?? 0}
          />

          <PageHeader
            eyebrow="Your student support space"
            title={<>{getGreeting()}, {profile?.pen_name ?? "there"} 👋</>}
            description="Take a moment for yourself. Support is here when you need it."
            actions={
              <div className="dashboard-shortcuts">
                <Link href="/student/threads" className="dashboard-icon-link" aria-label="Conversations" title="Conversations">💬</Link>
                <Link href="/student/group-chat" className="dashboard-icon-link" aria-label="Group chats" title="Group chats">👥</Link>
                <Link href="/student/threads/new" className="btn btn-primary btn-sm" title="Create a conversation">
                  + New Conversation
                </Link>
              </div>
            }
          />

          <div className="dashboard-feature-grid">
            <DashboardFeatureCard href="/student/messages" icon="message" title="Messages"
              description="Reach out to your counselor privately."
              value={myQueue?.status === "active" ? "In session" : undefined} />
            <DashboardFeatureCard href="/student/threads" icon="conversations" title="Conversations"
              description="Write privately and choose when to share." value={threads?.length ?? 0} />
            <DashboardFeatureCard href="/student/group-chat" icon="users" title="Group Chats"
              description="Connect with peers in supportive spaces." />
            <DashboardFeatureCard href="/focus-groups" icon="heart" title="Focus Groups"
              description="Explore groups around shared experiences." />
            <DashboardFeatureCard href="/freedom-wall" icon="board" title="Community Board"
              description="Share a thought or encouragement." />
            <DashboardFeatureCard href="/student/games" icon="game" title="Wellness Games"
              description="Try a grounding or calming activity." />
            <DashboardFeatureCard href="/student/appointments" icon="calendar" title="Appointments"
              description="Request or review a counselor appointment." value={appointments?.length ?? 0} />
            <DashboardFeatureCard href="/student/referrals" icon="notes" title="My Referrals"
              description="Review private support referrals from your counselor."
              value={pendingReferrals ? `${pendingReferrals} active` : undefined} />
            <DashboardFeatureCard href="/settings" icon="settings" title="Settings"
              description="Manage your account and preferences." />
          </div>

          {/* Queue Status Widget */}
          <section
            aria-label="Consultation status"
            className="card"
            style={{
              marginBottom: "2rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }} title="Consultation status" aria-hidden="true">
                    📋
                  </span>
                  <h2 style={{ fontSize: "1.1rem", margin: 0, color: "var(--text-primary)" }}>
                    {myQueue
                      ? myQueue.status === "active"
                        ? "You are Currently in Consultation"
                        : `You are #${positionInLine ?? 1} in line`
                      : "Messages"}
                  </h2>
                  {myQueue?.is_urgent && (
                    <span className="badge badge-danger">⚠️ Urgent Priority</span>
                  )}
                  {myQueue?.status === "active" && (
                    <span className="badge badge-success">Active Session</span>
                  )}
                </div>

                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: 0 }}>
                  {myQueue ? (
                    myQueue.status === "active" ? (
                      "The guidance counselor is active with your consultation. Head to Messages to converse."
                    ) : (
                      <>
                        Estimated position: <strong>#{positionInLine ?? 1}</strong>. Total of{" "}
                        <strong>{waitingCount ?? 0}</strong> student(s) currently waiting.
                      </>
                    )
                  ) : (
                    <>
                      {waitingCount === 0
                        ? "Send a message to get assistance."
                        : `${waitingCount} student(s) are currently waiting. Send a message to request support.`}
                    </>
                  )}
                </p>

                {/* Progress bar visual indicator for waiting students */}
                {myQueue && myQueue.status === "waiting" && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      background: "var(--bg-elevated)",
                      borderRadius: 99,
                      height: 8,
                      overflow: "hidden",
                      border: "1px solid var(--border-light)",
                      maxWidth: 320,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(20, Math.min(100, 100 - ((positionInLine ?? 1) - 1) * 20))}%`,
                        background: myQueue.is_urgent
                          ? "var(--danger)"
                          : "linear-gradient(90deg, var(--brand), var(--brand-light))",
                        borderRadius: 99,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                {myQueue ? (
                  <Link
                    href="/student/messages"
                    className={`btn ${myQueue.status === "active" ? "btn-success" : "btn-primary"}`}
                    title="Open private messages"
                  >
                    Open Messages 📩
                  </Link>
                ) : (
                  <Link
                    href="/student/messages"
                    className="btn btn-primary"
                    title="Request a consultation via messaging"
                  >
                    Request Consultation
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* Recent conversations */}
          <div style={{ marginBottom: "2rem" }}>
            <div className="section-header">
              <h2 className="section-title" style={{ fontSize: "1.1rem" }}>
                Recent Conversations
              </h2>
              <Link href="/student/threads" className="text-muted text-sm" title="View all conversations">
                View all →
              </Link>
            </div>
            {!threads?.length ? (
              <div className="empty-state">
                <div className="empty-state-icon" title="No conversations" aria-hidden="true">
                  💬
                </div>
                <h3>No conversations yet</h3>
                <Link
                  href="/student/threads/new"
                  className="btn btn-primary btn-sm"
                  title="Start a conversation"
                >
                  Start a conversation
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {threads.map((t) => (
                  <Link
                    key={t.id}
                    href={`/student/threads/${t.id}`}
                    className="thread-item"
                    title={`Open conversation: ${t.title}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="thread-title">{t.title}</span>
                      <span
                        className={`badge ${
                          t.visibility === "shared" ? "badge-brand" : "badge-muted"
                        }`}
                      >
                        {t.visibility === "shared" ? "🔓 Shared" : "🔒 Private"}
                      </span>
                    </div>
                    <div className="thread-meta">
                      <span className="text-muted">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent appointments */}
          <div style={{ marginBottom: "2rem" }}>
            <div className="section-header">
              <h2 className="section-title" style={{ fontSize: "1.1rem" }}>
                Appointments
              </h2>
              <Link
                href="/student/appointments"
                className="text-muted text-sm"
                title="View all appointments"
              >
                View all →
              </Link>
            </div>
            {!appointments?.length ? (
              <div className="card card-sm">
                <p className="text-muted text-sm">
                  No appointments yet.{" "}
                  <Link href="/student/appointments" title="Request an appointment">
                    Request one →
                  </Link>
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {appointments.map((a) => (
                  <div key={a.id} className="card card-sm flex items-center justify-between">
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {new Date(a.requested_at).toLocaleString()}
                    </span>
                    <span
                      className={`badge ${
                        a.status === "confirmed"
                          ? "badge-success"
                          : a.status === "declined"
                          ? "badge-danger"
                          : "badge-warning"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* While you wait... section */}
          <section
            aria-label="Wellness and Activities While Waiting"
            className="card"
            style={{
              marginTop: "2rem",
              background:
                "linear-gradient(135deg, rgba(var(--brand-rgb), 0.12), rgba(var(--accent-rgb), 0.08))",
              borderColor: "rgba(var(--brand-rgb), 0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 260 }}>
                <span
                  style={{ fontSize: "2.5rem" }}
                  title="Relaxing Mini-Games"
                  aria-hidden="true"
                >
                  🎮
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: "1.15rem",
                      margin: 0,
                      color: "var(--text-primary)",
                    }}
                  >
                    While you wait...
                  </h3>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "0.88rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Need a breather or waiting for your consultation? Unwind with calming wellness
                    games and interactive relaxation exercises.
                  </p>
                </div>
              </div>
              <Link
                href="/student/games"
                className="btn btn-secondary"
                title="Play wellness games"
              >
                Play Games 🎮
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
