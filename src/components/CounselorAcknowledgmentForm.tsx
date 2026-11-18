"use client";

import type { CounselorAcknowledgmentStatements } from "@/lib/counselor-acknowledgment";
import { COUNSELOR_RESPONSIBILITIES } from "@/lib/counselor-acknowledgment";

export function CounselorAcknowledgmentForm({
  statements,
  onChange,
  acknowledged,
  onAcknowledge,
}: {
  statements: CounselorAcknowledgmentStatements;
  onChange: (next: CounselorAcknowledgmentStatements) => void;
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  const allChecked = COUNSELOR_RESPONSIBILITIES.every(
    ({ key }) => statements[key],
  );

  return (
    <section className="card consent-form" aria-labelledby="acknowledgment-title">
      <header className="consent-heading">
        <div>
          <p className="page-eyebrow">MenTalks: A Continuing Mental Health and Well-Being Initiative</p>
          <h2 id="acknowledgment-title">Counselor Acknowledgment</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm consent-print-button" onClick={() => window.print()}>
          Download / Print
        </button>
      </header>
      <p className="consent-intro">
        Please read each responsibility below. By acknowledging, you confirm that you understand and will uphold your role in Mentalks.
      </p>
      <div className="consent-checks">
        {COUNSELOR_RESPONSIBILITIES.map(({ key, label }) => (
          <label key={key} className="consent-check">
            <input
              type="checkbox"
              checked={statements[key]}
              onChange={(event) => onChange({ ...statements, [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {acknowledged && (
        <p className="consent-confirmed" role="status">
          Your acknowledgment is ready to be saved.
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={onAcknowledge}
        disabled={!allChecked}
      >
        I Acknowledge
      </button>
      <p className="form-hint consent-version">
        Acknowledgment version 2026-01. Your acknowledgment and timestamp are stored securely.
      </p>
    </section>
  );
}
