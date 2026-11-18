"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";

interface Appointment { id: string; requested_at: string; notes: string; status: string; }

function StudentAppointmentsContent() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") ?? "";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ date: dateParam, time: "", notes: "" });

  useEffect(() => {
    if (dateParam) {
      setForm(prev => ({ ...prev, date: dateParam }));
    }
  }, [dateParam]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("appointments")
        .select("*").eq("student_id", user.id).order("requested_at", { ascending: false });
      setAppointments(data ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.time) { showToast("Date and time are required.", "error"); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const requested_at = `${form.date}T${form.time}:00`;
      const { data, error } = await supabase.from("appointments")
        .insert({ student_id: user.id, requested_at, notes: form.notes, status: "pending" })
        .select().single();
      if (error) throw error;
      setAppointments(prev => [data, ...prev]);
      setForm({ date: "", time: "", notes: "" });
      showToast("Appointment requested!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not request appointment.", "error");
    } finally { setSubmitting(false); }
  }

  const statusClass: Record<string, string> = {
    pending: "badge-warning", confirmed: "badge-success", declined: "badge-danger"
  };

  return (
    <main className="page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/student" className="text-muted text-sm">← Dashboard</Link>
      </div>
      <h1 style={{ marginBottom: "0.5rem" }}>Appointments</h1>
      <p className="text-muted mb-3">Request a session with your counselor.</p>

      <div className="card mb-3">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Request a New Appointment</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="appt-date">Date</label>
              <input id="appt-date" className="form-input" type="date"
                value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                min={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="appt-time">Time</label>
              <input id="appt-time" className="form-input" type="time"
                value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="appt-notes">Notes (optional)</label>
            <textarea id="appt-notes" className="form-textarea" placeholder="Briefly describe what you'd like to discuss…"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 80 }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Request Appointment"}
          </button>
        </form>
      </div>

      <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>My Appointment Requests</h2>
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
              <div className="flex items-center justify-between">
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {new Date(a.requested_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className={`badge ${statusClass[a.status] ?? "badge-muted"}`}>{a.status}</span>
              </div>
              {a.notes && <p className="text-muted mt-1" style={{ fontSize: "0.88rem" }}>{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function StudentAppointmentsPage() {
  return (
    <Suspense
      fallback={
        <main className="page" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="flex items-center gap-2 text-muted">
            <div className="spinner" style={{ width: 20, height: 20 }} /> Loading…
          </div>
        </main>
      }
    >
      <StudentAppointmentsContent />
    </Suspense>
  );
}

