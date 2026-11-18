import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DashboardFeatureCard } from "@/components/DashboardFeatureCard";
import { getGreeting } from "@/lib/greeting";

export const metadata = {
  title: "Counselor Dashboard | Mentalks",
};

export default async function CounselorDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("public_name, role, position, avatar_id")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "counselor") redirect("/login");

  // Shared threads (recent 5)
  const { data: threads } = await supabase
    .from("threads")
    .select("id, title, shared_at, profiles!student_id(public_name)")
    .eq("visibility", "shared")
    .order("shared_at", { ascending: false })
    .limit(5);

  // Pending appointments (next 5)
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, requested_at, status, profiles!student_id(public_name)")
    .eq("status", "pending")
    .order("requested_at")
    .limit(5);

  // Stats counts
  const { count: totalSharedThreads } = await supabase
    .from("threads")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "shared");

  const { count: totalPendingAppts } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: waitingStudents } = await supabase
    .from("consultation_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "waiting");

  // Urgent messages
  const { count: urgentMessages } = await supabase
    .from("private_messages")
    .select("id", { count: "exact", head: true })
    .eq("is_urgent", true)
    .eq("urgent_acknowledged", false);

  return (
    <>
      <Navbar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} showBack={false} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">

          {/* Header */}
          <PageHeader
            eyebrow="Counselor workspace"
            title={<>{getGreeting()}, {profile?.public_name ?? "Counselor"} <span className="verified-counselor-badge">Verified Counselor</span></>}
            description={`${profile?.position ?? "Guidance Counselor"} · A clear overview of your support work today.`}
            actions={
              <div className="dashboard-shortcuts">
                <Link href="/counselor/threads" className="dashboard-icon-link" aria-label="Conversations" title="Conversations">💬</Link>
                <Link href="/counselor/group-chat" className="dashboard-icon-link" aria-label="Group chats" title="Group chats">👥</Link>
                <Link href="/counselor/status" className="btn btn-secondary btn-sm">🟢 Update Status</Link>
              </div>
            }
          />

          <div className="dashboard-feature-grid counselor-feature-grid">
            <DashboardFeatureCard href="/counselor/messages" icon="message" title="Messages"
              description="Review and respond to student messages."
              value={urgentMessages ? `${urgentMessages} urgent` : `${waitingStudents ?? 0} waiting`} />
            <DashboardFeatureCard href="/counselor/threads" icon="conversations" title="Conversations"
              description="Continue conversations shared by students." value={totalSharedThreads ?? 0} />
            <DashboardFeatureCard href="/counselor/group-chat" icon="users" title="Group Chats"
              description="Join supportive student group spaces." />
            <DashboardFeatureCard href="/focus-groups" icon="heart" title="Focus Groups"
              description="Visit the groups you support." />
            <DashboardFeatureCard href="/counselor/notes" icon="notes" title="Guidance Notes"
              description="Review your private counselor notes." />
            <DashboardFeatureCard href="/counselor/appointments" icon="calendar" title="Appointments"
              description="Review and manage requests." value={totalPendingAppts ?? 0} />
            <DashboardFeatureCard href="/counselor/referrals" icon="notes" title="Referrals"
              description="Refer students to trusted services and follow up." />
            <DashboardFeatureCard href="/counselor/mentalks" icon="calendar" title="MenTalks Schedule"
              description="Update the monthly initiative schedule." />
            <DashboardFeatureCard href="/counselor/calendar" icon="calendar" title="Calendar"
              description="See the schedule at a glance." />
            <DashboardFeatureCard href="/counselor/status" icon="heart" title="Counselor Status"
              description="Let students know when you are available." />
            <DashboardFeatureCard href="/counselor/banner" icon="sparkles" title="Support Banner"
              description="Update the message shown to students." />
            <DashboardFeatureCard href="/settings" icon="settings" title="Settings"
              description="Manage account and display preferences." />
          </div>

          <div className="grid-2">
            {/* Shared conversations */}
            <div>
              <div className="section-header" style={{ marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.1rem" }}>Recent Conversations</h2>
                <Link href="/counselor/threads" className="text-muted text-sm">
                  View all →
                </Link>
              </div>
              {!threads?.length ? (
                <div className="card card-sm">
                  <div className="empty-state" style={{ padding: "2rem 1rem" }}>
                    <div className="empty-state-icon" aria-hidden="true">💬</div>
                    <h3>No shared conversations yet</h3>
                    <p className="text-muted text-sm">Students can share conversations with you from their dashboard.</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {threads.map((t: Record<string, unknown>) => (
                    <Link
                      key={t.id as string}
                      href={`/counselor/threads/${t.id}`}
                      className="thread-item"
                    >
                      <div className="flex items-center justify-between">
                        <span className="thread-title">{t.title as string}</span>
                        <span className="badge badge-brand">🔓 Shared</span>
                      </div>
                      <div className="thread-meta">
                        <span className="text-muted">
                          {(t.profiles as { public_name?: string })?.public_name ?? "Student"}
                        </span>
                        <span className="text-muted">·</span>
                        <span className="text-muted">
                          {t.shared_at
                            ? new Date(t.shared_at as string).toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Appointments */}
            <div>
              <div className="section-header" style={{ marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.1rem" }}>Pending Appointments</h2>
                <Link href="/counselor/appointments" className="text-muted text-sm">
                  View all →
                </Link>
              </div>
              {!appointments?.length ? (
                <div className="card card-sm">
                  <div className="empty-state" style={{ padding: "2rem 1rem" }}>
                    <div className="empty-state-icon" aria-hidden="true">📅</div>
                    <h3>No pending appointments</h3>
                    <p className="text-muted text-sm">You're all caught up!</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {appointments.map((a: Record<string, unknown>) => (
                    <Link
                      key={a.id as string}
                      href="/counselor/appointments"
                      className="thread-item"
                      style={{ textDecoration: "none" }}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {(a.profiles as { public_name?: string })?.public_name ?? "Student"}
                        </span>
                        <span className="badge badge-warning">pending</span>
                      </div>
                      <span className="text-muted text-sm">
                        {new Date(a.requested_at as string).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </>
  );
}
