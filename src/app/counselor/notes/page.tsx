"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { BackToDashboard } from "@/components/BackToDashboard";

interface StudentProfile {
  id: string;
  public_name: string;
}

interface CounselorNote {
  id: string;
  counselor_id: string;
  student_id?: string | null;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function CounselorNotesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [counselorId, setCounselorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string; role?: string; position?: string }>({});
  const [loading, setLoading] = useState(true);

  // Data
  const [notes, setNotes] = useState<CounselorNote[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");

  // Selected note / Editor state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formStudentId, setFormStudentId] = useState<string>("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auth & Initial Fetch
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("public_name, avatar_id, role, position")
        .eq("id", user.id)
        .single();

      if (prof?.role !== "counselor") {
        router.push("/login");
        return;
      }

      setCounselorId(user.id);
      setProfile(prof);

      // Fetch all student profiles for dropdown linking
      const { data: stData } = await supabase
        .from("profiles")
        .select("id, public_name")
        .eq("role", "student")
        .order("public_name");
      setStudents(stData ?? []);

      // Fetch counselor notes for this counselor
      const { data: notesData, error: notesError } = await supabase
        .from("counselor_notes")
        .select("*")
        .eq("counselor_id", user.id)
        .order("updated_at", { ascending: false });

      if (notesError) {
        showToast("Error loading notes: " + notesError.message, "error");
      } else {
        const fetchedNotes = notesData ?? [];
        setNotes(fetchedNotes);
        if (fetchedNotes.length > 0) {
          // Select first note by default
          loadNoteIntoEditor(fetchedNotes[0]);
        }
      }

      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Load a note into the editor
  const loadNoteIntoEditor = useCallback((note: CounselorNote) => {
    setSelectedNoteId(note.id);
    setFormTitle(note.title);
    setFormBody(note.body);
    setFormStudentId(note.student_id ?? "");
    setFormTags(Array.isArray(note.tags) ? [...note.tags] : []);
    setTagInput("");
    setShowDeleteConfirm(false);
  }, []);

  // Reset editor for a new note
  const handleNewNote = () => {
    setSelectedNoteId(null);
    setFormTitle("");
    setFormBody("");
    setFormStudentId("");
    setFormTags([]);
    setTagInput("");
    setShowDeleteConfirm(false);
  };

  // Map of studentId -> nickname for quick display
  const studentsMap = useMemo(() => {
    const map = new Map<string, StudentProfile>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // All unique tags across all counselor notes
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(n => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach(t => {
          if (t.trim()) tagSet.add(t.trim());
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filter notes by search query and tag filter
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // Tag filter
      if (selectedTagFilter !== "ALL") {
        if (!n.tags || !n.tags.some(t => t.toLowerCase() === selectedTagFilter.toLowerCase())) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = n.title.toLowerCase().includes(q);
        const bodyMatch = n.body.toLowerCase().includes(q);
        const student = n.student_id ? studentsMap.get(n.student_id) : null;
        const studentMatch = student ? student.public_name.toLowerCase().includes(q) : false;
        return titleMatch || bodyMatch || studentMatch;
      }

      return true;
    });
  }, [notes, selectedTagFilter, searchQuery, studentsMap]);

  // Tag manipulation
  const handleAddTag = (rawTag: string) => {
    const cleaned = rawTag.trim().replace(/^#/, "");
    if (!cleaned) return;
    if (formTags.some(t => t.toLowerCase() === cleaned.toLowerCase())) {
      setTagInput("");
      return;
    }
    setFormTags(prev => [...prev, cleaned]);
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // Similarity hint: Check if current note's tags match tags on another student's notes
  const similarityHint = useMemo(() => {
    if (!formTags.length) return null;

    for (const otherNote of notes) {
      // Must not be the note currently being edited
      if (otherNote.id === selectedNoteId) continue;
      // Must belong to a student
      if (!otherNote.student_id) continue;
      // Must be a DIFFERENT student than the one currently selected (if a student is selected)
      if (formStudentId && otherNote.student_id === formStudentId) continue;

      if (!Array.isArray(otherNote.tags)) continue;

      // Check for overlapping tags
      const matchingTag = otherNote.tags.find(ot =>
        formTags.some(ft => ft.toLowerCase() === ot.toLowerCase())
      );

      if (matchingTag) {
        const otherStudent = studentsMap.get(otherNote.student_id);
        const nickname = otherStudent?.public_name ?? "another student";
        return {
          otherNote,
          nickname,
          matchingTag,
        };
      }
    }

    return null;
  }, [formTags, notes, selectedNoteId, formStudentId, studentsMap]);

  // Save Note (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselorId) return;

    if (!formTitle.trim()) {
      showToast("Please enter a note title.", "error");
      return;
    }
    if (!formBody.trim()) {
      showToast("Please enter note content.", "error");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();

      if (selectedNoteId) {
        // Update existing note
        const { data, error } = await supabase
          .from("counselor_notes")
          .update({
            title: formTitle.trim(),
            body: formBody.trim(),
            student_id: formStudentId || null,
            tags: formTags,
            updated_at: nowIso,
          })
          .eq("id", selectedNoteId)
          .select()
          .single();

        if (error) throw error;

        setNotes(prev => {
          const updated = prev.map(n => (n.id === selectedNoteId ? (data as CounselorNote) : n));
          return updated.sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });

        showToast("Note updated successfully.", "success");
      } else {
        // Insert new note
        const { data, error } = await supabase
          .from("counselor_notes")
          .insert({
            counselor_id: counselorId,
            title: formTitle.trim(),
            body: formBody.trim(),
            student_id: formStudentId || null,
            tags: formTags,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .single();

        if (error) throw error;

        const createdNote = data as CounselorNote;
        setNotes(prev => [createdNote, ...prev]);
        setSelectedNoteId(createdNote.id);
        showToast("New note created.", "success");
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save note.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Delete Note
  const handleDelete = async () => {
    if (!selectedNoteId) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("counselor_notes")
        .delete()
        .eq("id", selectedNoteId);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== selectedNoteId));
      showToast("Note deleted.", "success");
      handleNewNote();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete note.", "error");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const downloadPrintableNote = () => {
    if (!selectedNoteId || !formTitle.trim() || !formBody.trim()) {
      showToast("Save the note before downloading it.", "error");
      return;
    }
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character] ?? character);
    const counselorName = `${profile.public_name ?? "Counselor"}, ${profile.position ?? "Guidance Counselor"}`;
    const noteDate = new Date(notes.find(note => note.id === selectedNoteId)?.created_at ?? new Date()).toLocaleDateString();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(formTitle)}</title>
      <style>
        body{font:16px/1.6 Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#17202a}
        h1{font-size:26px;margin-bottom:8px} .meta{color:#475569;font-size:14px;margin-bottom:24px}
        .body{white-space:pre-wrap;overflow-wrap:anywhere} .tags{margin-top:24px;color:#475569}
        @media print{body{max-width:none;margin:0;padding:0;color:#000}a{color:inherit} .meta,.tags{color:#333}}
      </style></head><body><h1>${escapeHtml(formTitle)}</h1>
      <div class="meta"><div>Date: ${escapeHtml(noteDate)}</div><div>Counselor: ${escapeHtml(counselorName)}</div></div>
      <div class="body">${escapeHtml(formBody)}</div>
      ${formTags.length ? `<div class="tags">Tags: ${formTags.map(escapeHtml).join(", ")}</div>` : ""}
      </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${formTitle.trim().replace(/[^a-z0-9-_]+/gi, "-") || "guidance-note"}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Printable note downloaded. Open it in your browser to print or save as PDF.", "success");
  };

  return (
    <>
      <Navbar role="counselor" nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", paddingBottom: "1.5rem" }}>
          <BackToDashboard role="counselor" />
          {/* Header */}
          <div className="section-header" style={{ marginBottom: "1rem" }}>
            <div>
              <h1 className="section-title">Counselor Private Notes</h1>
              <p className="text-muted text-sm" style={{ marginTop: "0.2rem" }}>
                🔒 Confidential case notes, observations, and follow-up records. Protected by Row-Level Security.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleNewNote}
              title="Create a new private note"
            >
              + New Note
            </button>
          </div>

          {/* Split View Container */}
          <div
            className="notes-split"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(300px, 360px) 1fr",
              gap: "1.25rem",
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* LEFT PANEL: Note List */}
            <div
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "1rem",
                overflow: "hidden",
                height: "100%",
              }}
            >
              {/* Search & Tag Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: "0.85rem", padding: "0.55rem 0.75rem" }}
                  placeholder="🔍 Search notes, body, or student…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search counselor notes"
                />

                <div className="flex items-center gap-1">
                  <select
                    className="form-select"
                    style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                    value={selectedTagFilter}
                    onChange={e => setSelectedTagFilter(e.target.value)}
                    aria-label="Filter notes by tag"
                  >
                    <option value="ALL">All Tags ({uniqueTags.length})</option>
                    {uniqueTags.map(tag => (
                      <option key={tag} value={tag}>
                        #{tag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes List */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  paddingRight: "0.25rem",
                }}
              >
                {loading ? (
                  <div className="flex items-center gap-2 text-muted" style={{ padding: "1rem" }}>
                    <div className="spinner" style={{ width: 18, height: 18 }} /> Loading notes…
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="empty-state" style={{ padding: "2rem 1rem" }}>
                    <div className="empty-state-icon" style={{ fontSize: "2rem" }}>
                      📝
                    </div>
                    <p className="text-muted text-sm">
                      {searchQuery || selectedTagFilter !== "ALL"
                        ? "No notes match your filters."
                        : "No notes yet. Click '+ New Note' to start."}
                    </p>
                  </div>
                ) : (
                  filteredNotes.map(n => {
                    const isSelected = n.id === selectedNoteId;
                    const linkedStudent = n.student_id ? studentsMap.get(n.student_id) : null;
                    const snippet = n.body.length > 60 ? n.body.slice(0, 60) + "…" : n.body;

                    return (
                      <div
                        key={n.id}
                        onClick={() => loadNoteIntoEditor(n)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            loadNoteIntoEditor(n);
                          }
                        }}
                        style={{
                          padding: "0.75rem 0.9rem",
                          borderRadius: "var(--radius-md)",
                          border: isSelected
                            ? "1px solid var(--brand)"
                            : "1px solid var(--border-light)",
                          background: isSelected
                            ? "rgba(var(--brand-rgb), 0.12)"
                            : "var(--bg-elevated)",
                          cursor: "pointer",
                          transition: "all var(--transition)",
                          outline: "none",
                        }}
                      >
                        <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem" }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              color: isSelected ? "var(--brand-light)" : "var(--text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {n.title || "Untitled Note"}
                          </span>
                          <span className="text-muted" style={{ fontSize: "0.72rem", flexShrink: 0 }}>
                            {new Date(n.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>

                        <p
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            lineHeight: 1.4,
                            margin: "0 0 0.4rem 0",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {snippet}
                        </p>

                        <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: "0.3rem" }}>
                          {linkedStudent ? (
                            <span
                              className="badge badge-muted"
                              style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                              title={`Linked student: ${linkedStudent.public_name}`}
                            >
                              👤 {linkedStudent.public_name}
                            </span>
                          ) : (
                            <span
                              className="badge badge-muted"
                              style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", opacity: 0.6 }}
                            >
                              General
                            </span>
                          )}

                          {Array.isArray(n.tags) && n.tags.length > 0 && (
                            <div className="flex items-center gap-1" style={{ flexWrap: "wrap" }}>
                              {n.tags.slice(0, 2).map(tag => (
                                <span
                                  key={tag}
                                  className="badge badge-brand"
                                  style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}
                                >
                                  #{tag}
                                </span>
                              ))}
                              {n.tags.length > 2 && (
                                <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                                  +{n.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Note Editor */}
            <div
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "1.5rem",
                overflowY: "auto",
                height: "100%",
              }}
            >
              {/* Top Banner / Similarity Hint */}
              {similarityHint && (
                <div
                  className="notice notice-warning"
                  style={{
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                  }}
                >
                  <span style={{ fontSize: "0.85rem" }}>
                    💡 Similar concern (<strong>#{similarityHint.matchingTag}</strong>) was noted for{" "}
                    <strong>{similarityHint.nickname}</strong>.
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--brand-light)", fontWeight: 600, padding: "0.2rem 0.5rem" }}
                    onClick={() => loadNoteIntoEditor(similarityHint.otherNote)}
                    title="Switch to similar note"
                  >
                    View that note →
                  </button>
                </div>
              )}

              <form onSubmit={handleSave} aria-label="Counselor note editor" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {/* Editor Header */}
                <div className="flex items-center justify-between" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", margin: 0 }}>
                      {selectedNoteId ? "Edit Private Note" : "New Private Note"}
                    </h2>
                    <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                      Only accessible to you. Never shared with students.
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {selectedNoteId && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={downloadPrintableNote}>
                        Download Printable HTML
                      </button>
                    )}
                    {selectedNoteId && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={saving || deleting}
                        title="Delete this note"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={saving || deleting}
                      title="Save note changes"
                    >
                      {saving ? (
                        <>
                          <span className="spinner" style={{ width: 14, height: 14 }} /> Saving…
                        </>
                      ) : selectedNoteId ? (
                        "Save Changes"
                      ) : (
                        "Create Note"
                      )}
                    </button>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
                  {/* Title */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="note-title">
                      Note Title *
                    </label>
                    <input
                      id="note-title"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Initial session notes, Anxiety management followup…"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  {/* Student Selector */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="note-student">
                      Linked Student (Optional)
                    </label>
                    <select
                      id="note-student"
                      className="form-select"
                      value={formStudentId}
                      onChange={e => setFormStudentId(e.target.value)}
                    >
                      <option value="">— None (General Counselor Note) —</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.public_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" htmlFor="note-tag-input">
                    Tags (Press Enter or comma to add)
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.4rem 0.6rem",
                      minHeight: 44,
                    }}
                  >
                    {formTags.map(tag => (
                      <span
                        key={tag}
                        className="badge badge-brand"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", gap: "0.35rem" }}
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          title={`Remove tag ${tag}`}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--brand-light)",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      id="note-tag-input"
                      type="text"
                      placeholder={formTags.length === 0 ? "Type tag (e.g. stress, exam, sleep) & hit Enter…" : "Add more…"}
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        } else if (e.key === "Backspace" && !tagInput && formTags.length > 0) {
                          handleRemoveTag(formTags[formTags.length - 1]);
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-primary)",
                        outline: "none",
                        fontSize: "0.85rem",
                        flex: 1,
                        minWidth: 140,
                      }}
                    />
                  </div>
                </div>

                {/* Body Textarea */}
                <div className="form-group" style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: 0 }}>
                  <label className="form-label" htmlFor="note-body">
                    Confidential Notes Content *
                  </label>
                  <textarea
                    id="note-body"
                    className="form-textarea"
                    placeholder="Write detailed session notes, behavioral observations, agreed next steps, mental health indicators…"
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    style={{
                      flex: 1,
                      minHeight: 260,
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                      resize: "vertical",
                    }}
                    required
                  />
                </div>
              </form>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm Note Deletion"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <h3 className="modal-title" style={{ color: "var(--danger)" }}>
                  Delete Counselor Note?
                </h3>
                <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete <strong>{formTitle || "this note"}</strong>? This action cannot be undone.
                </p>
                <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Confirm Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
