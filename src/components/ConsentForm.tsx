"use client";

import type { ConsentChoices } from "@/lib/consent";

const REQUIRED_CHOICES: Array<{ key: keyof Omit<ConsentChoices, "public_release">; label: string }> = [
  {
    key: "purpose",
    label: "I understand MenTalks supports well-being, reduces stigma, and offers a respectful way to seek support.",
  },
  {
    key: "voluntary",
    label: "I understand that interviews and story sharing are voluntary. I may decline any question or withdraw at any time.",
  },
  {
    key: "identity_protection",
    label: "I understand that names will not be disclosed, faces will be blurred or excluded, and identifying details removed when needed.",
  },
  {
    key: "publication_review",
    label: "I understand that a story or interview will only be shared on the official SSC platform after separate consent is secured.",
  },
  {
    key: "referral_sharing",
    label: "I understand the Guidance Counselor may refer me to another service when helpful, and will explain what information is shared and with whom.",
  },
];

export function ConsentForm({
  choices,
  onChange,
  acknowledged,
  onAcknowledge,
  readOnly = false,
}: {
  choices: ConsentChoices;
  onChange: (next: ConsentChoices) => void;
  acknowledged: boolean;
  onAcknowledge?: () => void;
  readOnly?: boolean;
}) {
  function setChoice(key: keyof ConsentChoices, checked: boolean) {
    onChange({ ...choices, [key]: checked });
  }

  const requiredComplete = REQUIRED_CHOICES.every(choice => choices[choice.key]);

  return (
    <section className="card consent-form" aria-labelledby="consent-title">
      <header className="consent-heading">
        <div>
          <p className="page-eyebrow">MenTalks: A Continuing Mental Health and Well-Being Initiative</p>
          <h2 id="consent-title">Consent Form</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm consent-print-button" onClick={() => window.print()}>
          Download / Print
        </button>
      </header>
      <p className="consent-intro">
        Please read each statement. Your support through Mentalks does not depend on agreeing to publish a story.
      </p>
      <div className="consent-checks">
        {REQUIRED_CHOICES.map(choice => (
          <label key={choice.key} className="consent-check">
            <input type="checkbox" checked={choices[choice.key]} disabled={readOnly}
              onChange={event => setChoice(choice.key, event.target.checked)} />
            <span>{choice.label}</span>
          </label>
        ))}
        <label className="consent-check consent-optional">
          <input type="checkbox" checked={choices.public_release} disabled={readOnly}
            onChange={event => setChoice("public_release", event.target.checked)} />
          <span><strong>Optional:</strong> I agree to have selected portions of my story or interview published anonymously on the official SSC platform.</span>
        </label>
      </div>
      {acknowledged && <p className="consent-confirmed" role="status">Your consent choices are ready to be saved.</p>}
      {!readOnly && (
        <button type="button" className="btn btn-primary" onClick={onAcknowledge}
          disabled={!requiredComplete || !onAcknowledge}>
          I Agree
        </button>
      )}
      <p className="form-hint consent-version">Consent form version 2026-01. Your choices and timestamp are stored securely.</p>
    </section>
  );
}
