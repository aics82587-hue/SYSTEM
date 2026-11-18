"use client";

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UrgentWarningDialog({ isOpen, onConfirm, onCancel }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="urgent-dialog-title"
      onClick={onCancel}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          border: "1px solid rgba(248, 113, 113, 0.4)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(248, 113, 113, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span
            style={{ fontSize: "1.8rem", color: "var(--danger)" }}
            title="Urgent alert icon"
            aria-hidden="true"
          >
            ⚠️
          </span>
          <h2
            id="urgent-dialog-title"
            className="modal-title"
            style={{ margin: 0, color: "var(--danger)", fontSize: "1.25rem" }}
          >
            Mark as Urgent?
          </h2>
        </div>

        <div
          style={{
            fontSize: "0.92rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <p style={{ margin: 0 }}>
            Marking your message as <strong>URGENT</strong> means you need immediate attention
            from the guidance counselor.
          </p>

          <div
            className="notice notice-danger"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.86rem",
            }}
          >
            <p style={{ fontWeight: 600, color: "var(--danger)", marginBottom: "0.4rem" }}>
              ⚠️ Important reminders:
            </p>
            <ul style={{ paddingLeft: "1.2rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <li>Only use this if you are genuinely in crisis or need immediate help</li>
              <li>
                Misuse of the urgent flag (for jokes, testing, or non-emergencies) may result in a
                warning or restriction on your account
              </li>
              <li>
                If you clicked this by accident, please send a follow-up message to the counselor
                explaining the mistake
              </li>
            </ul>
          </div>

          <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>
            Are you sure you want to mark this as urgent?
          </p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            title="Cancel and keep message standard"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-danger"
            title="Confirm marking message as urgent"
          >
            Yes, Mark as Urgent
          </button>
        </div>
      </div>
    </div>
  );
}
