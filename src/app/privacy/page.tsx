import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & Confidentiality — Mentalks",
  description: "Learn how Mentalks protects your privacy and the limits of confidentiality.",
};

export default function PrivacyPage() {
  return (
    <main className="page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/" className="text-muted text-sm">← Back to home</Link>
      </div>

      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔒</div>
        <h1 style={{ fontSize: "2rem" }}>Privacy &amp; Confidentiality</h1>
        <p className="text-muted mt-1">Last updated: October 2026</p>
      </div>

      <div className="privacy-section">
        <h2>1. What We Collect</h2>
        <p>
          Mentalks collects the following information when you register and use the platform:
        </p>
        <ul>
          <li>Student ID and birthdate (for identity verification)</li>
          <li>Nickname, email address, and encrypted password</li>
          <li>Conversation messages and focus group posts you create</li>
          <li>Appointment requests you submit</li>
        </ul>
      </div>

      <div className="privacy-section">
        <h2>2. How We Use Your Data</h2>
        <p>
          Your data is used solely to provide mental health support services within your school. We do not sell or
          share your information with third parties. Counselors can only see conversations you explicitly mark as
          <strong> &ldquo;Shared with counselor&rdquo;</strong>. All other conversations remain private.
        </p>
      </div>

      <div className="privacy-section">
        <h2>3. Data Security</h2>
        <p>
          All data is stored in a secure, encrypted database. Passwords are hashed and never stored in plain text.
          Connections to the platform use HTTPS/TLS encryption. Access is restricted by role — students cannot
          see other students&apos; private conversations.
        </p>
      </div>

      <div className="privacy-section">
        <h2>4. Limits of Confidentiality</h2>
        <div className="notice notice-warning" style={{ marginBottom: "1rem" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>⚠️ Important Notice</p>
          <p>
            While Mentalks is designed to be private, confidentiality has legal and ethical limits.
            Information may be disclosed without your consent in the following situations:
          </p>
        </div>
        <ul>
          <li>If you disclose intent to harm yourself or others</li>
          <li>If there is reasonable suspicion of child abuse or neglect</li>
          <li>If required by a court order or applicable law</li>
          <li>If a counselor determines there is imminent risk to your safety</li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          In such cases, the appropriate school personnel or emergency services may be notified.
          Counselors will always try to discuss this with you first when it is safe to do so.
        </p>
      </div>

      <div className="privacy-section">
        <h2>5. Session &amp; Inactivity</h2>
        <p>
          For your protection, you will be automatically signed out after 15 minutes of inactivity.
          This helps protect your information if you leave a device unattended.
        </p>
      </div>

      <div className="privacy-section">
        <h2>6. Your Rights</h2>
        <ul>
          <li>You may request access to your personal data at any time.</li>
          <li>You may request deletion of your account and associated data.</li>
          <li>You may withdraw consent to data processing by contacting the school counseling office.</li>
        </ul>
      </div>

      <div className="privacy-section">
        <h2>7. Contact</h2>
        <p>
          If you have questions about this privacy notice or how your data is handled, please contact
          the school guidance and counseling office.
        </p>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link href="/" className="btn btn-secondary">← Back to Mentalks</Link>
      </div>
    </main>
  );
}
