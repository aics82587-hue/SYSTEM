"use client";

import Link from "next/link";

export function PrivacyNoticePrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="modal-overlay" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-prompt-title">
        <p className="page-eyebrow">Before you continue</p>
        <h2 className="modal-title" id="privacy-prompt-title">Privacy &amp; Confidentiality</h2>
        <p>
          Your information is used to provide BSC well-being support and is visible only to the people
          permitted by your privacy settings. Confidentiality may have limits when there is an immediate
          safety concern or disclosure is required by law. Read the full <Link href="/privacy">Privacy Notice</Link>.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onDismiss}>
            I understand, continue
          </button>
        </div>
      </section>
    </div>
  );
}
