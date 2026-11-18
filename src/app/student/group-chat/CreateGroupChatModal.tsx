"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface StudentOption {
  id: string;
  public_name: string;
}

interface CounselorOption {
  id: string;
  public_name: string;
}

interface CreateGroupChatModalProps {
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGroupChatModal({
  currentUserId,
  isOpen,
  onClose,
}: CreateGroupChatModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [chatName, setChatName] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [counselor, setCounselor] = useState<CounselorOption | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available students and counselor when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      setLoadingMembers(true);
      setError(null);
      try {
        // Fetch students (exclude self)
        const { data: studentsData, error: studentsErr } = await supabase
          .from("profiles")
          .select("id, public_name")
          .eq("role", "student")
          .neq("id", currentUserId)
          .order("public_name");

        if (studentsErr) throw studentsErr;

        // Fetch counselor
        const { data: counselorData, error: counselorErr } = await supabase
          .from("profiles")
          .select("id, public_name")
          .eq("role", "counselor")
          .limit(1)
          .maybeSingle();

        if (counselorErr) throw counselorErr;

        if (isMounted) {
          setStudents(studentsData || []);
          setCounselor(counselorData || null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load member list";
          setError(msg);
        }
      } finally {
        if (isMounted) setLoadingMembers(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUserId, supabase]);

  if (!isOpen) return null;

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = chatName.trim();
    if (!trimmedName) {
      setError("Please enter a chat name.");
      return;
    }

    // Validation: at least 2 other students selected (creator + counselor + >= 2 students)
    if (selectedStudentIds.length < 2) {
      setError("Please select at least 2 other students to join the group chat.");
      return;
    }

    if (!counselor) {
      setError("A counselor must be available in the system before creating a group chat.");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Insert into group_chats
      const { data: newChat, error: chatErr } = await supabase
        .from("group_chats")
        .insert({
          name: trimmedName,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (chatErr || !newChat) {
        throw new Error(chatErr?.message || "Failed to create group chat");
      }

      // 2. Prepare member records:
      // - Creator (self)
      // - Counselor (is_counselor: true)
      // - Selected students (is_counselor: false)
      const membersToInsert = [
        {
          chat_id: newChat.id,
          user_id: currentUserId,
          is_counselor: false,
        },
        {
          chat_id: newChat.id,
          user_id: counselor.id,
          is_counselor: true,
        },
        ...selectedStudentIds.map((sId) => ({
          chat_id: newChat.id,
          user_id: sId,
          is_counselor: false,
        })),
      ];

      const { error: membersErr } = await supabase
        .from("group_chat_members")
        .insert(membersToInsert);

      if (membersErr) {
        throw new Error(membersErr.message);
      }

      // Reset state and redirect
      setChatName("");
      setSelectedStudentIds([]);
      onClose();
      router.push(`/student/group-chat/${newChat.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating group chat";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter((s) =>
    s.public_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
      <div className="modal" style={{ maxWidth: "560px", width: "95%" }}>
        <h2 id="create-group-title" className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span title="Group chat icon" role="img" aria-hidden="true">
            👥
          </span>
          Create New Group Chat
        </h2>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
          Start a supportive group discussion. A counselor is automatically included for guidance and safety.
        </p>

        {error && (
          <div className="notice notice-danger mb-2" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} aria-label="Create group chat form">
          <div className="form-group">
            <label htmlFor="group-name-input" className="form-label">
              Group Chat Name *
            </label>
            <input
              id="group-name-input"
              type="text"
              className="form-input"
              placeholder="e.g. Exam Stress Support Circle"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              disabled={isSubmitting}
              maxLength={60}
              required
              aria-label="Group chat name"
            />
          </div>

          {/* Counselor auto-inclusion */}
          <div className="form-group">
            <label className="form-label">Counselor (Auto-Included)</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.9rem",
                background: "rgba(34, 211, 165, 0.08)",
                border: "1px solid rgba(34, 211, 165, 0.25)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label="Counselor auto-included"
                  style={{ accentColor: "var(--success)", cursor: "not-allowed" }}
                />
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {counselor ? counselor.public_name : "Guidance Counselor"}
                </span>
              </div>
              <span className="badge badge-success" title="Counselor is a mandatory group member">
                Counselor (Required)
              </span>
            </div>
            <p className="form-hint" style={{ marginTop: "0.3rem" }}>
              Per school safety guidelines, a counselor is always present in all student group chats.
            </p>
          </div>

          {/* Student selection */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label className="form-label" style={{ margin: 0 }}>
                Select Members (Min. 2 Other Students) *
              </label>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: selectedStudentIds.length >= 2 ? "var(--success)" : "var(--warning)",
                  fontWeight: 600,
                }}
              >
                {selectedStudentIds.length} student{selectedStudentIds.length === 1 ? "" : "s"} selected
              </span>
            </div>

            {/* Filter input */}
            <input
              type="text"
              className="form-input"
              placeholder="Search classmates by pen name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Filter students by pen name"
              style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", marginBottom: "0.5rem" }}
            />

            {/* Student list */}
            <div
              style={{
                maxHeight: "180px",
                overflowY: "auto",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                padding: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                background: "var(--bg-elevated)",
              }}
              role="group"
              aria-label="Student member checklist"
            >
              {loadingMembers ? (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)" }}>
                  <div className="spinner" style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ fontSize: "0.85rem" }}>Loading students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1.25rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {students.length === 0 ? "No other students registered." : "No classmates matched your search."}
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isChecked = selectedStudentIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.45rem 0.6rem",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        background: isChecked ? "rgba(var(--brand-rgb), 0.12)" : "transparent",
                        transition: "background var(--transition)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleStudent(s.id)}
                        disabled={isSubmitting}
                        aria-label={`Select ${s.public_name}`}
                        style={{ accentColor: "var(--brand)", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 500 }}>
                        {s.public_name}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              title="Cancel group chat creation"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || selectedStudentIds.length < 2 || !chatName.trim()}
              title="Create new group chat"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner" style={{ width: "16px", height: "16px" }} />
                  Creating...
                </>
              ) : (
                "Create Group Chat"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupChatModal;
