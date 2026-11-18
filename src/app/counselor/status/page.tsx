import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusForm } from "./StatusForm";

export const metadata = {
  title: "My Status | Mentalks Counselor",
};

export default async function CounselorStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("public_name, avatar_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "counselor") redirect("/login");

  // Fetch current status
  const { data: currentStatusRow } = await supabase
    .from("counselor_status")
    .select("status, reason, updated_at")
    .eq("counselor_id", user.id)
    .maybeSingle();

  const currentStatus = currentStatusRow?.status ?? "available";
  const currentReason = currentStatusRow?.reason ?? null;

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "available":
        return { label: "Available", badge: "badge-success", icon: "🟢" };
      case "in_consultation":
        return { label: "In Consultation", badge: "badge-danger", icon: "🔴" };
      case "away":
        return { label: "Away", badge: "badge-warning", icon: "🟡" };
      case "not_in_office":
        return { label: "Not in Office", badge: "badge-muted", icon: "⚫" };
      case "online_only":
        return { label: "Online Only", badge: "badge-brand", icon: "🔵" };
      default:
        return { label: st, badge: "badge-brand", icon: "🟢" };
    }
  };

  const badgeInfo = getStatusBadge(currentStatus);

  return (
    <>
      <Navbar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          <div className="section-header">
            <div>
              <h1 className="section-title">Counselor Availability Status</h1>
              <p className="text-muted" style={{ marginTop: "0.25rem" }}>
                Keep students informed about your real-time presence and consultation mode.
              </p>
            </div>

            {/* Current status chip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                background: "var(--bg-card)",
                padding: "0.6rem 1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Current live status:
              </span>
              <span
                style={{ fontSize: "1.1rem" }}
                title={`Status: ${badgeInfo.label}`}
                aria-hidden="true"
              >
                {badgeInfo.icon}
              </span>
              <span className={`badge ${badgeInfo.badge}`}>
                {badgeInfo.label}
              </span>
            </div>
          </div>

          {currentReason && currentStatus === "away" && (
            <div
              className="notice notice-warning"
              style={{ marginBottom: "1.5rem" }}
              role="status"
            >
              <strong>Currently Away:</strong> {currentReason}
            </div>
          )}

          <StatusForm
            counselorId={user.id}
            initialStatus={currentStatus}
            initialReason={currentReason}
          />
        </main>
      </div>
    </>
  );
}
