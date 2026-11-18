import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";

export default async function ModeratorDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("public_name, avatar_id, role").eq("id", user.id).single();
  if (profile?.role !== "moderator") redirect("/login");

  const { data: reports } = await supabase
    .from("post_reports").select("id").eq("reviewed", false);

  return (
    <>
      <Navbar role="moderator" nickname={profile?.public_name} avatarId={profile?.avatar_id} showBack={false} />
      <div className="dashboard-layout">
        <Sidebar role="moderator" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          <h1 className="section-title mb-3">Moderator Dashboard</h1>
          <div className="grid-3">
            <Link href="/moderator/reports" style={{ textDecoration: "none" }}>
              <div className="card card-sm" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "1.8rem" }}>🚩</span>
                <div>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--danger)", margin: 0 }}>{reports?.length ?? 0}</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>Pending Reports</p>
                </div>
              </div>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
