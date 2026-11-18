"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeatureIcon } from "@/components/FeatureIcon";
import { BackToDashboard } from "@/components/BackToDashboard";
import { AvatarPicker } from "@/components/AvatarPicker";
import { PenNameBadge } from "@/components/PenNameBadge";
import type { AppRole } from "@/lib/identity";
import { ConsentForm } from "@/components/ConsentForm";
import { CONSENT_VERSION, EMPTY_CONSENT_CHOICES, type ConsentChoices } from "@/lib/consent";

interface ConsentRecord {
  version: string;
  event_type: "accepted" | "withdrawn";
  choices: ConsentChoices;
  created_at: string;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AppRole>("student");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarId, setAvatarId] = useState("lavender-cat");
  const [penName, setPenName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [consentChoices, setConsentChoices] = useState<ConsentChoices>(EMPTY_CONSENT_CHOICES);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("public_name, pen_name, avatar_id, role, position").eq("id", user.id).maybeSingle();
      if (profileError) {
        showToast(`Could not load account settings: ${profileError.message}`, "error");
        return;
      }
      setUserId(user.id);
      setRole((profile?.role as AppRole) ?? "student");
      setNickname(profile?.public_name ?? "");
      setPenName(profile?.pen_name ?? "");
      setPosition(profile?.position ?? "");
      setAvatarId(profile?.avatar_id ?? "lavender-cat");
      setEmail(user.email ?? "");
      setProfileLoaded(true);
      if (profile?.role !== "counselor") {
        const { data: records, error: consentError } = await supabase.from("consent_records")
          .select("version, event_type, choices, created_at").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(10);
        if (consentError) {
          showToast(`Could not load consent history: ${consentError.message}`, "error");
        } else {
          const history = (records ?? []) as ConsentRecord[];
          setConsentHistory(history);
          const accepted = history.find(record => record.event_type === "accepted");
          if (accepted) setConsentChoices(accepted.choices);
        }
      }
    }

    void load();
  }, [router, showToast]);

  async function updateAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!currentPassword) {
      showToast("Enter your current password to confirm this change.", "error");
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast("Enter a valid email address.", "error");
      return;
    }
    if (newPassword && (
      newPassword.length < 8 ||
      !/[a-z]/.test(newPassword) ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    )) {
      showToast("New password must be at least 8 characters and include uppercase, lowercase, and a number.", "error");
      return;
    }
    if (!normalizedEmail && !newPassword) {
      showToast("Enter a new email address or password.", "error");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (authError) throw new Error("The current password is incorrect.");

      const changes: { email?: string; password?: string } = {};
      if (normalizedEmail && normalizedEmail !== email.toLowerCase()) changes.email = normalizedEmail;
      if (newPassword) changes.password = newPassword;
      if (!Object.keys(changes).length) throw new Error("Choose an email or password different from your current one.");

      const { error } = await supabase.auth.updateUser(changes);
      if (error) throw error;
      if (changes.email) {
        showToast("Email change requested. Confirm the new address using the link Supabase sent.", "success");
      } else {
        showToast("Password updated successfully.", "success");
      }
      setCurrentPassword("");
      setNewEmail("");
      setNewPassword("");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Could not update your account.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveIdentity(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    const update: { avatar_id: string; pen_name?: string } = { avatar_id: avatarId };
    if (role === "student") update.pen_name = penName.trim();
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Profile updated.", "success");
  }

  async function withdrawConsent() {
    if (!window.confirm("Withdraw your current consent? You will need to review and accept the form again before using the app.")) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("record_consent", {
      _version: CONSENT_VERSION,
      _choices: {},
      _event_type: "withdrawn",
    });
    if (error) {
      showToast(`Could not withdraw consent: ${error.message}`, "error");
      return;
    }
    showToast("Your consent was withdrawn. Please review the form to continue.", "success");
    router.replace("/consent");
  }

  return (
    <>
      <Navbar role={role} nickname={nickname} showThemeToggle={false} />
      <div className="dashboard-layout">
        <Sidebar role={role} nickname={nickname} />
        <main className="dashboard-main">
          <BackToDashboard role={role} />
          <PageHeader title="Settings" description="Your account, appearance, and privacy preferences." />
          <div className="settings-layout">
            <div className="settings-sidebar">
              <section className="card settings-section">
                <h2 className="settings-section-title"><FeatureIcon name="user" size={19} /> Profile</h2>
                <div className="settings-profile">
                  <div>
                    <strong><PenNameBadge name={role === "student" ? penName : nickname || "Mentalks member"}
                      avatarId={avatarId} role={role} position={role === "student" ? undefined : position} /></strong>
                    <span className="text-muted text-sm">{role}</span>
                  </div>
                </div>
                <form onSubmit={saveIdentity} className="settings-identity-form">
                  {role === "student" && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="pen-name">Pen name</label>
                      <input id="pen-name" className="form-input" value={penName} onChange={(event) => setPenName(event.target.value)} required minLength={3} maxLength={32} />
                      <span className="form-hint">Pen name changes are checked for uniqueness and limited to once every 30 days.</span>
                    </div>
                  )}
                  <AvatarPicker value={avatarId} onChange={setAvatarId} />
                  <button className="btn btn-secondary btn-sm" type="submit">Save profile</button>
                </form>
              </section>
              <section className="card settings-section">
                <h2 className="settings-section-title"><FeatureIcon name="sparkles" size={19} /> Theme</h2>
                <p className="text-muted text-sm">Choose the look that feels comfortable for you.</p>
                <ThemeToggle />
              </section>
              <section className="card settings-section">
                <h2 className="settings-section-title"><FeatureIcon name="shield" size={19} /> Privacy</h2>
                <p className="text-muted text-sm">Review how your information and conversations are handled.</p>
                <Link href="/privacy" className="btn btn-secondary btn-sm">Read privacy notice</Link>
                {profileLoaded && role !== "counselor" && (
                  <>
                    <h3 className="settings-section-title mt-2">Consent history</h3>
                    {!consentHistory.length ? <p className="text-muted text-sm">No consent record found.</p> : (
                      <>
                        <p className="text-muted text-sm">
                          Latest: {consentHistory[0].event_type} · {consentHistory[0].version} · {new Date(consentHistory[0].created_at).toLocaleString()}
                        </p>
                        <ConsentForm choices={consentChoices} onChange={setConsentChoices} acknowledged
                          readOnly />
                        {consentHistory[0].event_type === "accepted" && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void withdrawConsent()}>
                            Withdraw consent
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
            <section className="card settings-form-card">
              <h2 className="settings-section-title"><FeatureIcon name="settings" size={19} /> Email and password</h2>
              <p className="text-muted text-sm mb-2">Confirm your current password before making an account change.</p>
              <p className="settings-current-email">Current email <strong>{email || "—"}</strong></p>
              <form onSubmit={updateAccount}>
                <div className="form-group">
                  <label className="form-label" htmlFor="current-password">Current password</label>
                  <input id="current-password" className="form-input" type="password" autoComplete="current-password"
                    value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-email">New email (optional)</label>
                  <input id="new-email" className="form-input" type="email" autoComplete="email"
                    value={newEmail} onChange={event => setNewEmail(event.target.value)} />
                  <span className="form-hint">A confirmation link will be sent before the new email takes effect.</span>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">New password (optional)</label>
                  <input id="new-password" className="form-input" type="password" autoComplete="new-password"
                    value={newPassword} onChange={event => setNewPassword(event.target.value)} />
                  <span className="form-hint">At least 8 characters, including uppercase, lowercase, and a number.</span>
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Updating…" : "Update Account"}
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
