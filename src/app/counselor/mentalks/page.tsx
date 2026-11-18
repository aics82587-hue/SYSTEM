"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { BackToDashboard } from "@/components/BackToDashboard";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/ToastProvider";

export default function MenTalksSchedulePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState("lavender-cat");
  const [scheduleText, setScheduleText] = useState("Every first Friday of the month");
  const [location, setLocation] = useState("Guidance Counselor's Office");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role, public_name, avatar_id").eq("id", user.id).single();
      if (profileError || profile?.role !== "counselor") { router.replace("/login"); return; }
      setUserId(user.id);
      setName(profile.public_name ?? "Guidance Counselor");
      setAvatarId(profile.avatar_id ?? "lavender-cat");
      const { data, error } = await supabase.from("mentalks_schedule")
        .select("schedule_text, location, note").eq("id", 1).single();
      if (error) showToast(`Could not load the schedule: ${error.message}`, "error");
      else if (data) {
        setScheduleText(data.schedule_text);
        setLocation(data.location);
        setNote(data.note);
      }
      setLoading(false);
    }
    void load();
  }, [router, showToast]);

  async function saveSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!scheduleText.trim() || !location.trim()) {
      showToast("Add a schedule and location before saving.", "error");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("mentalks_schedule").update({
      schedule_text: scheduleText.trim(),
      location: location.trim(),
      note: note.trim(),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) showToast(`Could not save the schedule: ${error.message}`, "error");
    else showToast("MenTalks schedule updated.", "success");
    setSaving(false);
  }

  return (
    <>
      <Navbar role="counselor" nickname={name} avatarId={avatarId} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={name} avatarId={avatarId} />
        <main className="dashboard-main">
          <BackToDashboard role="counselor" compact />
          <PageHeader title="MenTalks Schedule" description="Keep the monthly program schedule current for the BSC community." />
          <section className="card schedule-editor">
            {loading ? <p className="text-muted">Loading schedule…</p> : (
              <form onSubmit={saveSchedule}>
                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-text">Schedule</label>
                  <input id="schedule-text" className="form-input" value={scheduleText}
                    onChange={event => setScheduleText(event.target.value)} maxLength={160} required />
                  <span className="form-hint">Default: every first Friday of the month. Update this text if the date or time changes.</span>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-location">Location</label>
                  <input id="schedule-location" className="form-input" value={location}
                    onChange={event => setLocation(event.target.value)} maxLength={160} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-note">Additional note (optional)</label>
                  <textarea id="schedule-note" className="form-textarea" value={note}
                    onChange={event => setNote(event.target.value)} maxLength={500} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save schedule"}
                </button>
              </form>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
