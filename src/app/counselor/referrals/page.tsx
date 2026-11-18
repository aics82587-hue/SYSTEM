"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { BackToDashboard } from "@/components/BackToDashboard";

interface Member { id: string; public_name: string; }
interface ReferralService {
  id: string;
  name: string;
  category: string;
  contact_details: string;
  location: string;
  archived_at: string | null;
}
interface Referral {
  id: string;
  student_id: string;
  student?: { public_name?: string };
  service_name: string;
  service_type: string;
  contact_details: string;
  location: string;
  reason: string;
  urgency: "routine" | "soon" | "urgent";
  status: "sent" | "seen" | "scheduled" | "completed" | "closed";
  message: string;
  follow_up_date: string | null;
  counselor_followup_note: string;
  created_at: string;
}
interface ReferralMessage { id: string; sender_id: string; body: string; created_at: string; }
type ReferralFilter = "new" | "in_progress" | "done";

export default function CounselorReferralsPage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string }>({});
  const [counselorId, setCounselorId] = useState("");
  const [students, setStudents] = useState<Member[]>([]);
  const [services, setServices] = useState<ReferralService[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [messages, setMessages] = useState<Record<string, ReferralMessage[]>>({});
  const [studentId, setStudentId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<Referral["urgency"]>("routine");
  const [message, setMessage] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [serviceForm, setServiceForm] = useState({ name: "", category: "", contact_details: "", location: "" });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ReferralFilter>("new");

  useEffect(() => {
    let active = true;
    async function load() {
      setStudentId(new URLSearchParams(window.location.search).get("student") ?? "");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/login"); return; }
      const { data: counselor, error: profileError } = await supabase.from("profiles")
        .select("public_name, avatar_id, role").eq("id", user.id).single();
      if (profileError || counselor?.role !== "counselor") { window.location.assign("/login"); return; }
      const [studentResult, serviceResult, referralResult] = await Promise.all([
        supabase.from("profiles").select("id, public_name").eq("role", "student").order("public_name"),
        supabase.from("referral_services").select("*").order("name"),
        supabase.from("referrals").select("*, student:profiles!student_id(public_name)").order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (studentResult.error || serviceResult.error || referralResult.error) {
        showToast(studentResult.error?.message ?? serviceResult.error?.message ?? referralResult.error?.message ?? "Could not load referrals.", "error");
      }
      setCounselorId(user.id);
      setProfile(counselor);
      setStudents(studentResult.data ?? []);
      setServices(serviceResult.data ?? []);
      setReferrals((referralResult.data ?? []) as Referral[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [showToast]);

  function chooseService(id: string) {
    setServiceId(id);
    const service = services.find(item => item.id === id);
    if (!service) return;
    setServiceName(service.name);
    setServiceType(service.category);
    setContactDetails(service.contact_details);
    setLocation(service.location);
  }

  async function createReferral(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId || !serviceName.trim() || !reason.trim()) {
      showToast("Choose a student, referral destination, and reason.", "error");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("referrals").insert({
      student_id: studentId,
      counselor_id: counselorId,
      service_id: serviceId || null,
      service_name: serviceName.trim(),
      service_type: serviceType.trim(),
      contact_details: contactDetails.trim(),
      location: location.trim(),
      reason: reason.trim(),
      urgency,
      message: message.trim(),
      follow_up_date: followUpDate || null,
    }).select("*, student:profiles!student_id(public_name)").single();
    if (error) {
      showToast(`Could not send referral: ${error.message}`, "error");
    } else {
      setReferrals(current => [data as Referral, ...current]);
      setReason("");
      setMessage("");
      setFollowUpDate("");
      showToast("Referral sent privately to the student.", "success");
    }
    setSaving(false);
  }

  async function saveService(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceForm.name.trim()) return;
    const supabase = createClient();
    const values = {
      name: serviceForm.name.trim(),
      category: serviceForm.category.trim(),
      contact_details: serviceForm.contact_details.trim(),
      location: serviceForm.location.trim(),
    };
    const { data, error } = editingServiceId
      ? await supabase.from("referral_services").update(values).eq("id", editingServiceId).select().single()
      : await supabase.from("referral_services").insert({ counselor_id: counselorId, ...values }).select().single();
    if (error) showToast(`Could not save resource: ${error.message}`, "error");
    else {
      setServices(current => {
        const next = editingServiceId
          ? current.map(service => service.id === editingServiceId ? data as ReferralService : service)
          : [...current, data as ReferralService];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setServiceForm({ name: "", category: "", contact_details: "", location: "" });
      setEditingServiceId(null);
      showToast(editingServiceId ? "Referral resource updated." : "Referral resource saved.", "success");
    }
  }

  async function archiveService(service: ReferralService) {
    const supabase = createClient();
    const { error } = await supabase.from("referral_services").update({ archived_at: new Date().toISOString() }).eq("id", service.id);
    if (error) showToast(`Could not archive resource: ${error.message}`, "error");
    else setServices(current => current.map(item => item.id === service.id ? { ...item, archived_at: new Date().toISOString() } : item));
  }

  async function updateServiceArchive(service: ReferralService, archived: boolean) {
    const archivedAt = archived ? new Date().toISOString() : null;
    const supabase = createClient();
    const { error } = await supabase.from("referral_services").update({ archived_at: archivedAt }).eq("id", service.id);
    if (error) showToast(`Could not update resource: ${error.message}`, "error");
    else setServices(current => current.map(item => item.id === service.id ? { ...item, archived_at: archivedAt } : item));
  }

  async function updateReferral(id: string, patch: Partial<Referral>) {
    const supabase = createClient();
    const { data, error } = await supabase.from("referrals").update(patch).eq("id", id).select().single();
    if (error) showToast(`Could not update referral: ${error.message}`, "error");
    else setReferrals(current => current.map(item => item.id === id ? { ...item, ...data } as Referral : item));
  }

  async function sendReply(referralId: string) {
    const body = replyDrafts[referralId]?.trim();
    if (!body) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("referral_messages")
      .insert({ referral_id: referralId, sender_id: counselorId, body }).select().single();
    if (error) showToast(`Could not send reply: ${error.message}`, "error");
    else {
      setMessages(current => ({ ...current, [referralId]: [...(current[referralId] ?? []), data as ReferralMessage] }));
      setReplyDrafts(current => ({ ...current, [referralId]: "" }));
    }
  }

  async function loadReplies(referralId: string) {
    if (messages[referralId]) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("referral_messages").select("*").eq("referral_id", referralId).order("created_at");
    if (error) showToast(`Could not load referral replies: ${error.message}`, "error");
    else setMessages(current => ({ ...current, [referralId]: data ?? [] }));
  }

  const visibleReferrals = referrals.filter(referral =>
    filter === "new" ? referral.status === "sent"
      : filter === "in_progress" ? ["seen", "scheduled"].includes(referral.status)
        : ["completed", "closed"].includes(referral.status)
  );

  return (
    <>
      <Navbar role="counselor" nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          <BackToDashboard role="counselor" />
          <h1 className="section-title mb-1">Student Referrals</h1>
          <p className="text-muted mb-3">Private referrals and follow-up are visible only to you and the referred student.</p>

          <section className="card mb-3">
            <h2 className="settings-section-title">Create a referral</h2>
            <form onSubmit={createReferral} className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="referral-student">Student pen name</label>
                <select id="referral-student" className="form-select" value={studentId} onChange={event => setStudentId(event.target.value)} required>
                  <option value="">Choose a student</option>
                  {students.map(student => <option key={student.id} value={student.id}>{student.public_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="referral-resource">Saved resource (optional)</label>
                <select id="referral-resource" className="form-select" value={serviceId} onChange={event => chooseService(event.target.value)}>
                  <option value="">Enter a new destination</option>
                  {services.filter(service => !service.archived_at).map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="service-name">Referred to</label>
                <input id="service-name" className="form-input" value={serviceName} onChange={event => setServiceName(event.target.value)} required maxLength={160} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="service-type">Type / category</label>
                <input id="service-type" className="form-input" value={serviceType} onChange={event => setServiceType(event.target.value)} maxLength={120} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="service-contact">Contact details</label>
                <input id="service-contact" className="form-input" value={contactDetails} onChange={event => setContactDetails(event.target.value)} maxLength={500} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="service-location">Address / location</label>
                <input id="service-location" className="form-input" value={location} onChange={event => setLocation(event.target.value)} maxLength={500} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="referral-reason">Confidential reason / concern</label>
                <textarea id="referral-reason" className="form-textarea" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="referral-message">Message to student (optional)</label>
                <textarea id="referral-message" className="form-textarea" value={message} onChange={event => setMessage(event.target.value)} maxLength={2000} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="referral-urgency">Urgency</label>
                <select id="referral-urgency" className="form-select" value={urgency} onChange={event => setUrgency(event.target.value as Referral["urgency"])}>
                  <option value="routine">Routine</option><option value="soon">Soon</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="referral-followup">Follow-up date (optional)</label>
                <input id="referral-followup" className="form-input" type="date" value={followUpDate} onChange={event => setFollowUpDate(event.target.value)} />
              </div>
              <div className="form-group grid-span-2">
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Sending…" : "Send Private Referral"}</button>
              </div>
            </form>
          </section>

          <section className="card mb-3">
            <h2 className="settings-section-title">Referral resource directory</h2>
            <form onSubmit={saveService} className="grid-2">
              <input aria-label="Resource name" className="form-input" placeholder="Service or person" value={serviceForm.name} onChange={event => setServiceForm({ ...serviceForm, name: event.target.value })} required />
              <input aria-label="Resource category" className="form-input" placeholder="Type / category" value={serviceForm.category} onChange={event => setServiceForm({ ...serviceForm, category: event.target.value })} />
              <input aria-label="Resource contact details" className="form-input" placeholder="Contact details" value={serviceForm.contact_details} onChange={event => setServiceForm({ ...serviceForm, contact_details: event.target.value })} />
              <input aria-label="Resource location" className="form-input" placeholder="Address / location" value={serviceForm.location} onChange={event => setServiceForm({ ...serviceForm, location: event.target.value })} />
              <div className="flex gap-2 grid-span-2">
                <button className="btn btn-secondary btn-sm" type="submit">{editingServiceId ? "Update resource" : "Save resource"}</button>
                {editingServiceId && <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
                  setEditingServiceId(null);
                  setServiceForm({ name: "", category: "", contact_details: "", location: "" });
                }}>Cancel</button>}
              </div>
            </form>
            <ul className="referral-resource-list">
              {services.map(service => (
                <li key={service.id}>
                  <span><strong>{service.name}</strong> · {service.category || "Resource"}{service.archived_at ? " (archived)" : ""}</span>
                  {service.archived_at ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => updateServiceArchive(service, false)}>Restore</button>
                  ) : (
                    <span className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setEditingServiceId(service.id);
                        setServiceForm({ name: service.name, category: service.category, contact_details: service.contact_details, location: service.location });
                      }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => archiveService(service)}>Archive</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="section-header mb-2">
              <h2 className="section-title">Referral follow-up</h2>
              <div className="filter-tabs" role="tablist" aria-label="Referral status filter">
                {([
                  ["new", "New"],
                  ["in_progress", "In progress"],
                  ["done", "Done"],
                ] as const).map(([key, title]) => (
                  <button type="button" key={key} role="tab" aria-selected={filter === key}
                    className={`filter-tab${filter === key ? " active" : ""}`} onClick={() => setFilter(key)}>
                    {title}
                  </button>
                ))}
              </div>
            </div>
            {loading ? <p className="text-muted">Loading referrals…</p> : referrals.length === 0 ? (
              <div className="empty-state"><h3>No referrals yet</h3><p>New referrals you send will appear here.</p></div>
            ) : visibleReferrals.length === 0 ? (
              <div className="empty-state"><h3>No {filter === "in_progress" ? "in-progress" : filter} referrals</h3></div>
            ) : visibleReferrals.map(referral => (
              <article className="card mb-2" key={referral.id}>
                <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: ".5rem" }}>
                  <div><strong>{referral.student?.public_name ?? "Student"}</strong> · {referral.service_name}</div>
                  <span className={`badge ${referral.urgency === "urgent" ? "badge-danger" : "badge-brand"}`}>{referral.urgency}</span>
                </div>
                <p className="text-muted text-sm mt-1">{referral.reason}</p>
                {referral.contact_details && <p className="text-sm">Contact: {referral.contact_details}</p>}
                {referral.location && <p className="text-sm">Location: {referral.location}</p>}
                <div className="grid-2 mt-2">
                  <label className="form-group"><span className="form-label">Status</span>
                    <select className="form-select" value={referral.status} onChange={event => void updateReferral(referral.id, { status: event.target.value as Referral["status"] })}>
                      {["sent", "seen", "scheduled", "completed", "closed"].map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label className="form-group"><span className="form-label">Follow-up date</span>
                    <input type="date" className="form-input" value={referral.follow_up_date ?? ""} onChange={event => void updateReferral(referral.id, { follow_up_date: event.target.value || null })} />
                  </label>
                  <label className="form-group grid-span-2"><span className="form-label">Private counselor follow-up note</span>
                    <textarea className="form-textarea" defaultValue={referral.counselor_followup_note} onBlur={event => {
                      if (event.target.value !== referral.counselor_followup_note) void updateReferral(referral.id, { counselor_followup_note: event.target.value });
                    }} />
                  </label>
                </div>
                <details className="mt-2" onToggle={event => { if (event.currentTarget.open) void loadReplies(referral.id); }}>
                  <summary className="btn btn-ghost btn-sm">Private replies</summary>
                  {(messages[referral.id] ?? []).map(reply => <p key={reply.id} className="text-sm mt-1">{reply.body}</p>)}
                  <div className="flex gap-2 mt-1">
                    <input className="form-input" aria-label="Reply to student" value={replyDrafts[referral.id] ?? ""} onChange={event => setReplyDrafts(current => ({ ...current, [referral.id]: event.target.value }))} />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void sendReply(referral.id)}>Reply</button>
                  </div>
                </details>
              </article>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
