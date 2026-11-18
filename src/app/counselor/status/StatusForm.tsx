"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  counselorId: string;
  initialStatus: string;
  initialReason: string | null;
}

type CounselorStatus = "available" | "in_consultation" | "away" | "not_in_office" | "online_only";

interface StatusOption {
  value: CounselorStatus;
  label: string;
  icon: string;
  description: string;
  badgeClass: string;
  colorBorder: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "available",
    label: "Available",
    icon: "🟢",
    description: "In the office and ready for walk-in or online consultations.",
    badgeClass: "badge-success",
    colorBorder: "rgba(34, 211, 165, 0.4)",
  },
  {
    value: "in_consultation",
    label: "In Consultation",
    icon: "🔴",
    description: "Currently assisting a student. New message requests will be handled in order.",
    badgeClass: "badge-danger",
    colorBorder: "rgba(248, 113, 113, 0.4)",
  },
  {
    value: "away",
    label: "Away",
    icon: "🟡",
    description: "Temporarily away from desk. Choose or specify an away reason.",
    badgeClass: "badge-warning",
    colorBorder: "rgba(251, 191, 36, 0.4)",
  },
  {
    value: "not_in_office",
    label: "Not in Office",
    icon: "⚫",
    description: "Not in the counseling office today. Direct students to online messaging.",
    badgeClass: "badge-muted",
    colorBorder: "rgba(94, 91, 128, 0.4)",
  },
  {
    value: "online_only",
    label: "Online Only",
    icon: "🔵",
    description: "Conducting appointments and chats exclusively online today.",
    badgeClass: "badge-brand",
    colorBorder: "rgba(var(--brand-rgb), 0.4)",
  },
];

const PRESETS = [
  "Faculty meeting",
  "Comfort room break",
  "Getting lunch",
  "Running an errand",
  "Left for the day",
  "Other...",
];

export function StatusForm({ counselorId, initialStatus, initialReason }: Props) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<CounselorStatus>(
    (initialStatus as CounselorStatus) || "available"
  );

  // Initialize reason preset & custom text
  const isInitialPreset = initialReason ? PRESETS.slice(0, 5).includes(initialReason) : false;
  const [reasonPreset, setReasonPreset] = useState<string>(
    initialReason ? (isInitialPreset ? initialReason : "Other...") : PRESETS[0]
  );
  const [customReason, setCustomReason] = useState<string>(
    initialReason && !isInitialPreset ? initialReason : ""
  );

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const supabase = createClient();

    let finalReason: string | null = null;
    if (selectedStatus === "away") {
      finalReason = reasonPreset === "Other..." ? customReason.trim() : reasonPreset;
      if (!finalReason) {
        finalReason = "Temporarily away";
      }
    }

    try {
      const { error } = await supabase.from("counselor_status").upsert(
        {
          counselor_id: counselorId,
          status: selectedStatus,
          reason: finalReason,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "counselor_id" }
      );

      if (error) {
        throw error;
      }

      setFeedback({
        message: "Status updated successfully! Students will see this live.",
        type: "success",
      });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setFeedback({ message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Counselor Status Form" className="card">
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Update Your Availability</h2>
      <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        Your status is broadcast in real-time to all students visiting the Mentalks portal.
      </p>

      {feedback && (
        <div
          className={`notice ${feedback.type === "success" ? "notice-success" : "notice-danger"}`}
          style={{ marginBottom: "1.5rem" }}
          role="alert"
        >
          {feedback.message}
        </div>
      )}

      {/* Status options grid */}
      <div
        role="radiogroup"
        aria-label="Availability Status Options"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {STATUS_OPTIONS.map((opt) => {
          const isSelected = selectedStatus === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => setSelectedStatus(opt.value)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setSelectedStatus(opt.value);
                }
              }}
              style={{
                cursor: "pointer",
                padding: "1.1rem 1.25rem",
                borderRadius: "var(--radius-md)",
                background: isSelected ? "var(--bg-elevated)" : "rgba(22, 22, 42, 0.6)",
                border: `2px solid ${isSelected ? opt.colorBorder : "var(--border-light)"}`,
                boxShadow: isSelected ? "0 4px 20px rgba(0,0,0,0.3)" : "none",
                transition: "all var(--transition)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span
                    style={{ fontSize: "1.25rem" }}
                    title={`${opt.label} indicator`}
                    aria-hidden="true"
                  >
                    {opt.icon}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                    {opt.label}
                  </span>
                </div>
                <span className={`badge ${opt.badgeClass}`}>{isSelected ? "Selected" : opt.label}</span>
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                {opt.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Away Reason Settings (shown only when 'away' is selected) */}
      {selectedStatus === "away" && (
        <div
          className="card-sm"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            marginBottom: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="away-preset-select" className="form-label">
              Reason for Being Away
            </label>
            <select
              id="away-preset-select"
              aria-label="Select an away reason preset"
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              className="form-select"
            >
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {reasonPreset === "Other..." && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="away-custom-input" className="form-label">
                Custom Reason Details
              </label>
              <input
                id="away-custom-input"
                type="text"
                aria-label="Custom away reason"
                placeholder="e.g. Inspecting laboratory, back in 30 minutes"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={100}
                className="form-input"
              />
              <span className="form-hint">Brief note displayed to students while you are away.</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "1rem" }}>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary btn-lg"
          title="Save and broadcast status"
        >
          {saving ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18 }} />
              <span>Saving...</span>
            </>
          ) : (
            "Save Status"
          )}
        </button>
      </div>
    </form>
  );
}
