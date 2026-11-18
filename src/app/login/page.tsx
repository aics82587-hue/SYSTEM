"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcon";
import { PrivacyNoticePrompt } from "@/components/PrivacyNoticePrompt";
import { BrainLogo } from "@/components/BrainLogo";
import { getErrorMessage } from "@/lib/errors";

type Role = "student" | "counselor";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  function continueAfterNotice() {
    sessionStorage.setItem("mentalks-privacy-notice-seen", "true");
    setPrivacyNoticeOpen(false);
    if (pendingDestination) router.replace(pendingDestination);
  }

  function selectRole(role: Role) {
    setSelectedRole(role);
    setError("");
    setNeedsEmailConfirmation(false);
    setEmail("");
    setPassword("");
  }

  function goBack() {
    setSelectedRole(null);
    setError("");
    setNeedsEmailConfirmation(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) return;
    setError("");
    setNeedsEmailConfirmation(false);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInError?.code === "email_not_confirmed") {
        setNeedsEmailConfirmation(true);
        setError("Please confirm your email before signing in. Check your inbox and spam folder.");
        return;
      }
      if (signInError) throw signInError;
      if (!data.user) throw new Error("Login failed.");

      // Fetch role
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", data.user.id).single();
      if (profileError) throw profileError;

      const role = profile?.role;
      if (role === "moderator") {
        showToast("Welcome back!", "success");
        setPendingDestination("/moderator");
        setPrivacyNoticeOpen(true);
      } else if (role === selectedRole) {
        showToast("Welcome back!", "success");
        const destination = role === "counselor" ? "/counselor" : "/student";
        if (role === "counselor") {
          router.replace(destination);
        } else {
          setPendingDestination(destination);
          setPrivacyNoticeOpen(true);
        }
      } else if (role === "student" || role === "counselor") {
        setError(
          `This account is registered as a ${role}. Please go back and use the ${
            role === "counselor" ? "Guidance Counselor" : "Student"
          } login instead.`
        );
      } else {
        setError("This account is not part of the current Student–Guidance Counselor program. Please contact your administrator.");
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Something went wrong.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address above, then request a new confirmation email.");
      return;
    }
    setResendingConfirmation(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (resendError) throw resendError;
      setNeedsEmailConfirmation(false);
      showToast("A new confirmation email was sent. Check your inbox and spam folder.", "success");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Could not resend the confirmation email.");
      setError(msg);
    } finally {
      setResendingConfirmation(false);
    }
  }

  /* ── Role Selection Screen ── */
  if (!selectedRole) {
    return (
      <main className="page-center">
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand-dark), var(--brand-light))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2rem", margin: "0 auto 1.25rem",
              boxShadow: "0 0 32px rgba(var(--brand-rgb),0.2)"
            }}>
              <BrainLogo size={30} />
            </div>
            <p className="auth-wordmark">MenTalks</p>
            <h1 style={{ fontSize: "1.8rem" }}>Welcome back</h1>
            <p className="text-muted mt-1">Sign in to your Mentalks account.</p>
          </div>

          <div className="card">
            <p style={{
              textAlign: "center", fontSize: "0.95rem", fontWeight: 600,
              color: "var(--text-secondary)", marginBottom: "1.25rem"
            }}>
              Who are you signing in as?
            </p>

            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Student Card */}
              <button
                onClick={() => selectRole("student")}
                style={{
                  display: "flex", alignItems: "center", gap: "1.25rem",
                  padding: "1.25rem 1.5rem",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.2s ease",
                  width: "100%",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(var(--brand-rgb),0.16)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.2), rgba(var(--brand-rgb),0.08))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem", flexShrink: 0
                }}>
                  <FeatureIcon name="user" size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.2rem" }}>
                    Student
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Access your personal mental health support space
                  </div>
                </div>
                <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "1.1rem" }}>›</div>
              </button>

              {/* Counselor Card */}
              <button
                onClick={() => selectRole("counselor")}
                style={{
                  display: "flex", alignItems: "center", gap: "1.25rem",
                  padding: "1.25rem 1.5rem",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.2s ease",
                  width: "100%",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(var(--accent-rgb),0.16)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.2), rgba(var(--accent-rgb),0.08))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem", flexShrink: 0
                }}>
                  <FeatureIcon name="heart" size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.2rem" }}>
                    Guidance Counselor
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Manage student cases and appointments
                  </div>
                </div>
                <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "1.1rem" }}>›</div>
              </button>
            </div>

            <p className="text-center text-muted mt-2" style={{ fontSize: "0.88rem" }}>
              Don&apos;t have an account? <Link href="/signup">Create one</Link>
            </p>
          </div>

        </div>
      </main>
    );
  }

  /* ── Login Form Screen ── */
  const isStudent = selectedRole === "student";
  const roleLabel = selectedRole === "student" ? "Student" : "Guidance Counselor";
  const roleIcon: FeatureIconName = selectedRole === "student" ? "user" : "heart";
  const accentColor = "var(--brand)";
  const accentBg = "linear-gradient(135deg, rgba(var(--brand-rgb),0.2), rgba(var(--brand-rgb),0.08))";

  return (
    <>
    {privacyNoticeOpen && <PrivacyNoticePrompt onDismiss={continueAfterNotice} />}
    <main className="page-center">
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--brand-dark), var(--brand-light))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", margin: "0 auto 1.25rem",
            boxShadow: "0 0 32px rgba(var(--brand-rgb),0.2)"
          }}>
            <BrainLogo size={30} />
          </div>
          <p className="auth-wordmark">MenTalks</p>
          <h1 style={{ fontSize: "1.8rem" }}>Sign In</h1>
          <p className="text-muted mt-1">Enter your credentials below.</p>
        </div>

        <div className="card">
          {/* Role badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            padding: "0.85rem 1rem",
            background: "var(--bg-elevated)",
            border: `1px solid ${accentColor}`,
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-sm)",
              background: accentBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem", flexShrink: 0
            }}>
              <FeatureIcon name={roleIcon} size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Signing in as
              </div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                {roleLabel}
              </div>
            </div>
            <button
              onClick={goBack}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: "0.82rem", padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius-sm)", transition: "color 0.2s ease"
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              Change
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input id="email" className="form-input" type="email" placeholder="you@school.edu"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" className="form-input" type="password" placeholder="Your password"
                value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>

            {error && (
              <div className="notice notice-danger" style={{ marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.88rem", color: "var(--danger)" }}>{error}</span>
              </div>
            )}

            {needsEmailConfirmation && (
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={resendConfirmation}
                disabled={resendingConfirmation}
                style={{ marginBottom: "1rem" }}
              >
                {resendingConfirmation ? "Sending confirmation email…" : "Resend confirmation email"}
              </button>
            )}

            <button
              type="submit"
              className="btn w-full"
              disabled={loading}
              style={{
                background: "var(--brand-dark)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(var(--brand-rgb),0.18)",
              }}
            >
              {loading
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : `Sign in as ${roleLabel}`}
            </button>
          </form>

          <p className="text-center text-muted mt-2" style={{ fontSize: "0.88rem" }}>
            Don&apos;t have an account? <Link href="/signup">Create one</Link>
          </p>
        </div>

        <p className="text-center text-muted mt-2" style={{ fontSize: "0.78rem" }}>
        </p>
      </div>
    </main>
    </>
  );
}
