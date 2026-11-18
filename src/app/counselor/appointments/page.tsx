"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

interface Appt { id: string; requested_at: string; notes: string; status: string; student?: { public_name?: string }; }

export default function CounselorAppointmentsPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string; role?: string }>({});
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("public_name, avatar_id, role").eq("id", user.id).single();
      if (p?.role !== "counselor") { router.push("/login"); return; }
      setProfile(p);

      const { data } = await supabase
        .from("appointments")
        .select("*, student:profiles!student_id(public_name)")
        .order("requested_at");
      setAppointments(data ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: "confirmed" | "declined") {
    setActioning(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      showToast(`Appointment ${status}.`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally { setActioning(null); }
  }

  const statusBadge: Record<string, string> = { pending: "badge-warning", confirmed: "badge-success", declined: "badge-danger" };

  return (
    <>
      <Navbar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main">
          <h1 className="section-title mb-3">Appointments</h1>
          {loading ? (
            <div className="flex items-center gap-2 text-muted"><div className="spinner" style={{ width: 20, height: 20 }} /> Loading…</div>
          ) : !appointments.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <h3>No appointments yet</h3>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {appointments.map(a => (
                <div key={a.id} className="card card-sm">
                  <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {a.student?.public_name ?? "Unknown student"}
                      </p>
                      <p className="text-muted text-sm">
                        {new Date(a.requested_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}
                      </p>
                      {a.notes && <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{a.notes}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span className={`badge ${statusBadge[a.status] ?? "badge-muted"}`}>{a.status}</span>
                      {a.status === "pending" && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={actioning === a.id}
                            onClick={() => updateStatus(a.id, "confirmed")}>Confirm</button>
                          <button className="btn btn-danger btn-sm" disabled={actioning === a.id}
                            onClick={() => updateStatus(a.id, "declined")}>Decline</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
