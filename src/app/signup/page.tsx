"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { ConsentForm } from "@/components/ConsentForm";
import { BrainLogo } from "@/components/BrainLogo";
import { CONSENT_VERSION, EMPTY_CONSENT_CHOICES, type ConsentChoices } from "@/lib/consent";
import { validatePenName, type AvatarId } from "@/lib/identity";
import { getErrorMessage } from "@/lib/errors";

type Role = "student";

const STUDENT_ID_PATTERN = /^[0-9]{4}-[0-9]+-AB$/;

export default function SignupPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  /* ── Student fields ── */
  const [studentForm, setStudentForm] = useState({
    studentId: "", birthdate: "", penName: "",
    avatarId: "lavender-cat" as AvatarId, email: "", password: "", confirmPassword: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consentChoices, setConsentChoices] = useState<ConsentChoices>(EMPTY_CONSENT_CHOICES);
  const [consentAgreed, setConsentAgreed] = useState(false);

  function goBack() {
    setSelectedRole(null);
    setErrors({});
  }

  /* ── Validation ── */
  function validateStudent() {
    const e: Record<string, string> = {};
    if (!STUDENT_ID_PATTERN.test(studentForm.studentId.trim()))
      e.studentId = "Use the format YYYY-number-AB (e.g. 2024-00001-AB).";
    if (!studentForm.birthdate) e.birthdate = "Birthdate is required.";
    const penNameError = validatePenName(studentForm.penName);
    if (penNameError) e.penName = penNameError;
    if (!studentForm.email.trim() || !studentForm.email.includes("@")) e.email = "Valid email required.";
    if (studentForm.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (studentForm.password !== studentForm.confirmPassword) e.confirmPassword = "Passwords do not match.";
    return e;
  }

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) return;

    const errs = validateStudent();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!consentAgreed) {
      setErrors({ consent: "Review the consent statements and choose I Agree before creating your account." });
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const supabase = createClient();
      const emailRedirectTo = new URL("/login", window.location.origin).toString();

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: studentForm.email.trim().toLowerCase(),
        password: studentForm.password,
        options: {
          emailRedirectTo,
          data: {
            role: selectedRole,
            student_id: studentForm.studentId.trim(),
            birthdate: studentForm.birthdate,
            pen_name: studentForm.penName.trim(),
            avatar_id: studentForm.avatarId,
            consent_version: CONSENT_VERSION,
            consent_choices: consentChoices,
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Sign-up failed. Please try again.");
      if (authData.user.identities?.length === 0) {
        throw new Error("An account with this email already exists or is awaiting confirmation. Sign in and request a new confirmation email.");
      }

      showToast("Account created! Please check your email to confirm.", "success");
      router.push("/login");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Something went wrong.");
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  function studentField(key: keyof typeof studentForm, value: string) {
    setStudentForm(prev => ({ ...prev, [key]: value }));
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
            <h1 style={{ fontSize: "1.8rem" }}>Create Account</h1>
            <p className="text-muted mt-1">Join Mentalks to access support services.</p>
          </div>

          <div className="card">
            <p style={{
              textAlign: "center", fontSize: "0.95rem", fontWeight: 600,
              color: "var(--text-secondary)", marginBottom: "1.25rem"
            }}>
              I am creating an account as a…
            </p>

            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Student Card */}
              <button
                onClick={() => setSelectedRole("student")}
                style={{
                  display: "flex", alignItems: "center", gap: "1.25rem",
                  padding: "1.25rem 1.5rem",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.2s ease", width: "100%",
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
                    Access personal mental health support services
                  </div>
                </div>
                <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "1.1rem" }}>›</div>
              </button>

            </div>

            <p className="text-center text-muted mt-2" style={{ fontSize: "0.88rem" }}>
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </div>

          <p className="text-center text-muted mt-2" style={{ fontSize: "0.78rem" }}>
          </p>
        </div>
      </main>
    );
  }

  /* ── Form Screen ── */
  const roleLabel = "Student";
  const roleIcon: FeatureIconName = "user";
  const accentColor = "var(--brand)";
  const accentBg = "linear-gradient(135deg, rgba(var(--brand-rgb),0.2), rgba(var(--brand-rgb),0.08))";

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
          <h1 style={{ fontSize: "1.8rem" }}>Create Account</h1>
          <p className="text-muted mt-1">Fill in your details below.</p>
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
                Registering as
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
            {/* ── Student-specific fields ── */}
            <>
                <div className="form-group">
                  <label className="form-label" htmlFor="studentId">Student ID</label>
                  <input id="studentId" className="form-input" type="text" placeholder="e.g. 2024-00001-AB"
                    value={studentForm.studentId} onChange={e => studentField("studentId", e.target.value)} />
                  {errors.studentId && <span className="form-error">{errors.studentId}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="birthdate">Birthdate</label>
                  <input id="birthdate" className="form-input" type="date"
                    value={studentForm.birthdate} onChange={e => studentField("birthdate", e.target.value)} />
                  {errors.birthdate && <span className="form-error">{errors.birthdate}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pen-name">Pen name</label>
                  <input id="pen-name" className="form-input" type="text" autoComplete="off" maxLength={32}
                    placeholder="How you appear to other students"
                    value={studentForm.penName} onChange={e => studentField("penName", e.target.value)} />
                  {errors.penName && <span className="form-error">{errors.penName}</span>}
                  <span className="form-hint">Choose a unique, appropriate name and avoid using your real name. You can change it once every 30 days.</span>
                </div>
                <AvatarPicker value={studentForm.avatarId}
                  onChange={avatarId => studentField("avatarId", avatarId)} />

                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email Address</label>
                  <input id="email" className="form-input" type="email" placeholder="you@school.edu"
                    value={studentForm.email} onChange={e => studentField("email", e.target.value)} />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <input id="password" className="form-input" type="password" placeholder="Minimum 8 characters"
                    value={studentForm.password} onChange={e => studentField("password", e.target.value)} />
                  {errors.password && <span className="form-error">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                  <input id="confirmPassword" className="form-input" type="password" placeholder="Repeat your password"
                    value={studentForm.confirmPassword} onChange={e => studentField("confirmPassword", e.target.value)} />
                  {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
                </div>
            </>

            <ConsentForm choices={consentChoices}
              onChange={next => { setConsentChoices(next); setConsentAgreed(false); }}
              acknowledged={consentAgreed}
              onAcknowledge={() => { setConsentAgreed(true); setErrors(prev => ({ ...prev, consent: "" })); }} />
            {errors.consent && <p className="form-error" role="alert">{errors.consent}</p>}

            <button
              type="submit"
              className="btn w-full"
              disabled={loading}
              style={{
                marginTop: "0.75rem",
                background: "var(--brand-dark)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(var(--brand-rgb),0.18)",
              }}
            >
              {loading
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : `Create ${roleLabel} Account`}
            </button>
          </form>

          <p className="text-center text-muted mt-2" style={{ fontSize: "0.88rem" }}>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>

      </div>
    </main>
  );
}
