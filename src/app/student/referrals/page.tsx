"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { BackToDashboard } from "@/components/BackToDashboard";
import type { AppRole } from "@/lib/identity";

interface Referral {
  id: string;
  service_name: string;
  service_type: string;
  contact_details: string;
  location: string;
  reason: string;
  urgency: "routine" | "soon" | "urgent";
  status: "sent" | "seen" | "scheduled" | "completed" | "closed";
  message: string;
  follow_up_date: string | null;
  created_at: string;
}
interface ReferralMessage { id: string; sender_id: string; body: string; created_at: string; }

export default function StudentReferralsPage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string; role?: AppRole }>({});
  const [userId, setUserId] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [messages, setMessages] = useState<Record<string, ReferralMessage[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/login"); return; }
      const { data: current, error: profileError } = await supabase.from("profiles")
        .select("public_name, avatar_id, role").eq("id", user.id).single();
      if (profileError || current?.role !== "student") { window.location.assign("/login"); return; }
      const { data, error } = await supabase.from("referrals").select("*").eq("student_id", user.id).order("created_at", { ascending: false });
      if (!active) return;
      if (error) showToast(`Could not load your referrals: ${error.message}`, "error");
      setProfile({ ...current, role: current.role as AppRole });
      setUserId(user.id);
      setReferrals(data ?? []);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [showToast]);

  async function updateStatus(referral: Referral, status: Referral["status"]) {
    const supabase = createClient();
    const { error } = await supabase.from("referrals").update({ status }).eq("id", referral.id);
    if (error) showToast(`Could not update referral: ${error.message}`, "error");
    else {
      setReferrals(current => current.map(item => item.id === referral.id ? { ...item, status } : item));
      showToast("Referral status updated.", "success");
    }
  }

  async function loadMessages(referralId: string) {
    if (messages[referralId]) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("referral_messages").select("*").eq("referral_id", referralId).order("created_at");
    if (error) showToast(`Could not load replies: ${error.message}`, "error");
    else setMessages(current => ({ ...current, [referralId]: data ?? [] }));
  }

  async function sendReply(referralId: string) {
    const body = drafts[referralId]?.trim();
    if (!body) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("referral_messages")
      .insert({ referral_id: referralId, sender_id: userId, body }).select().single();
    if (error) showToast(`Could not send your reply: ${error.message}`, "error");
    else {
      setMessages(current => ({ ...current, [referralId]: [...(current[referralId] ?? []), data as ReferralMessage] }));
      setDrafts(current => ({ ...current, [referralId]: "" }));
      showToast("Your private reply was sent to the counselor.", "success");
    }
  }

  return (
    <>
      <Navbar role={profile.role ?? "student"} nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role={profile.role ?? "student"} nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          <BackToDashboard role={profile.role ?? "student"} />
          <h1 className="section-title mb-1">My Referrals</h1>
          <p className="text-muted mb-3">Referral details are private between you and the Guidance Counselor. You can update your status or reply at any time.</p>
          {loading ? <p className="text-muted">Loading your referrals…</p> : referrals.length === 0 ? (
            <div className="empty-state"><h3>No referrals right now</h3><p>If the counselor shares a referral with you, it will appear here.</p></div>
          ) : referrals.map(referral => (
            <article key={referral.id} className="card mb-2">
              <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: ".5rem" }}>
                <h2 className="settings-section-title">{referral.service_name}</h2>
                <span className={`badge ${referral.urgency === "urgent" ? "badge-danger" : "badge-brand"}`}>{referral.urgency}</span>
              </div>
              {referral.service_type && <p className="text-muted text-sm">{referral.service_type}</p>}
              <p className="mt-1">{referral.message || "Your counselor has shared a referral resource for you."}</p>
              {referral.contact_details && <p className="mt-1"><strong>Contact:</strong> {referral.contact_details}</p>}
              {referral.location && <p><strong>Location:</strong> {referral.location}</p>}
              <p className="text-muted text-sm mt-1">Shared {new Date(referral.created_at).toLocaleDateString()}{referral.follow_up_date ? ` · Follow-up ${new Date(`${referral.follow_up_date}T00:00:00`).toLocaleDateString()}` : ""}</p>
              <div className="form-group mt-2">
                <label className="form-label" htmlFor={`status-${referral.id}`}>Your status</label>
                <select id={`status-${referral.id}`} className="form-select" value={referral.status} disabled={referral.status === "closed"}
                  onChange={event => void updateStatus(referral, event.target.value as Referral["status"])}>
                  {["sent", "seen", "scheduled", "completed"].map(status => <option value={status} key={status}>{status === "sent" ? "Not seen yet" : status}</option>)}
                  {referral.status === "closed" && <option value="closed">Closed</option>}
                </select>
              </div>
              <details className="mt-2" onToggle={event => { if (event.currentTarget.open) void loadMessages(referral.id); }}>
                <summary className="btn btn-ghost btn-sm">Reply to counselor</summary>
                {(messages[referral.id] ?? []).map(item => (
                  <p key={item.id} className={`referral-message ${item.sender_id === userId ? "mine" : ""}`}>
                    {item.body}<span>{new Date(item.created_at).toLocaleString()}</span>
                  </p>
                ))}
                <div className="flex gap-2 mt-1">
                  <input className="form-input" aria-label="Message to counselor" value={drafts[referral.id] ?? ""} onChange={event => setDrafts(current => ({ ...current, [referral.id]: event.target.value }))} maxLength={4000} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void sendReply(referral.id)}>Send</button>
                </div>
              </details>
            </article>
          ))}
        </main>
      </div>
    </>
  );
}
