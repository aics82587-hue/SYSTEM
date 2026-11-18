"use client";

import { useMemo } from "react";

export interface ChatMember {
  user_id: string;
  is_counselor: boolean;
  nickname: string;
  role: string;
  position?: string;
}

interface GroupChatVisibilityPickerProps {
  members: ChatMember[];
  currentUserId: string;
  selectedIds: string[];
  onChange: (newSelectedIds: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function GroupChatVisibilityPicker({
  members,
  currentUserId,
  selectedIds,
  onChange,
  isOpen,
  onClose,
}: GroupChatVisibilityPickerProps) {
  // Counselor members
  const counselorMembers = useMemo(
    () => members.filter((m) => m.is_counselor || m.role === "counselor"),
    [members]
  );

  // Other student members (excluding self and counselor)
  const otherStudents = useMemo(
    () =>
      members.filter(
        (m) => m.user_id !== currentUserId && !m.is_counselor && m.role !== "counselor"
      ),
    [members, currentUserId]
  );

  // Count of other students selected
  const otherStudentsSelectedCount = useMemo(() => {
    return otherStudents.filter((s) => selectedIds.includes(s.user_id)).length;
  }, [otherStudents, selectedIds]);

  const isValid = otherStudentsSelectedCount >= 2;

  if (!isOpen) return null;

  const handleToggleStudent = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const handleSelectAll = () => {
    const allStudentIds = otherStudents.map((s) => s.user_id);
    const counselorIds = counselorMembers.map((c) => c.user_id);
    onChange(Array.from(new Set([...counselorIds, currentUserId, ...allStudentIds])));
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 250 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="visibility-picker-title"
    >
      <div
        className="modal"
        style={{
          maxWidth: "460px",
          width: "92%",
          boxShadow: "var(--shadow-md), var(--shadow-glow)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3
            id="visibility-picker-title"
            className="modal-title"
            style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span title="Visibility eye icon" role="img" aria-hidden="true">
              👁️
            </span>
            Message Visibility
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            title="Close visibility picker"
            aria-label="Close visibility picker"
            style={{ fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Control who can read this specific message. Only chosen members and the guidance counselor will see it.
        </p>

        {/* Counselor Always Included Notice */}
        <div
          style={{
            padding: "0.6rem 0.85rem",
            background: "rgba(34, 211, 165, 0.08)",
            border: "1px solid rgba(34, 211, 165, 0.25)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked
              disabled
              style={{ accentColor: "var(--success)", cursor: "not-allowed" }}
              aria-label="Counselor mandatory recipient"
            />
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {counselorMembers.length > 0
                ? counselorMembers.map((c) => `${c.nickname}, ${c.position ?? "Guidance Counselor"}`).join(", ")
                : "Guidance Counselor"}
            </span>
          </div>
          <span className="badge badge-success" title="Counselor always receives every group message">
            Counselor (Required)
          </span>
        </div>

        {/* Other Students Checklist Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Select Classmates (Min. 2)
          </span>
          <button
            type="button"
            onClick={handleSelectAll}
            className="btn btn-ghost btn-sm"
            title="Select all members"
            aria-label="Select all members"
            style={{ fontSize: "0.78rem", padding: "0.15rem 0.4rem", color: "var(--brand-light)" }}
          >
            Select All
          </button>
        </div>

        {/* Member checklist */}
        <div
          style={{
            maxHeight: "200px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            padding: "0.5rem",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}
          role="group"
          aria-label="Chat members selection"
        >
          {otherStudents.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem" }}>
              No other members in this group chat.
            </p>
          ) : (
            otherStudents.map((member) => {
              const isSelected = selectedIds.includes(member.user_id);
              return (
                <label
                  key={member.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.7rem",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: isSelected ? "rgba(var(--brand-rgb), 0.12)" : "transparent",
                    transition: "background var(--transition)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleStudent(member.user_id)}
                    style={{ accentColor: "var(--brand)", cursor: "pointer" }}
                    aria-label={`Allow ${member.nickname} to see this message`}
                  />
                  <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 500 }}>
                    {member.nickname}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Validation indicator */}
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: isValid ? "var(--success)" : "var(--warning)",
            }}
          >
            {otherStudentsSelectedCount} of {otherStudents.length} classmates selected
            {!isValid && " (At least 2 required)"}
          </span>
        </div>

        <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
            disabled={!isValid}
            title={isValid ? "Confirm recipients" : "Select at least 2 classmates to proceed"}
            aria-label="Confirm message visibility"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupChatVisibilityPicker;
