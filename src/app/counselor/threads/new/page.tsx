"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";

interface Student { id: string; public_name: string; role: string; }

export default function NewCounselorConversationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "counselor") { router.replace("/login"); return; }
      const { data, error } = await supabase.from("profiles")
        .select("id, public_name, role").in("role", ["student", "community_member"]).order("public_name");
      if (error) showToast(`Could not load students: ${error.message}`, "error");
      setStudents(data ?? []);
      setLoading(false);
    }
    void load();
  }, [router, showToast]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId || !title.trim() || !body.trim()) {
      showToast("Choose a community member and enter both a title and first message.", "error");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_conversation", {
      _title: title.trim(), _body: body.trim(), _student_id: studentId,
    });
    if (error) {
      showToast(`Could not create conversation: ${error.message}`, "error");
      setSaving(false);
      return;
    }
    showToast("Conversation created and shared with the student.", "success");
    router.push(`/counselor/threads/${data}`);
  }

  return (
    <main className="page" style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}><BackToDashboard role="counselor" /></div>
      <h1 className="section-title">Start a Conversation</h1>
      <p className="text-muted mb-3">The student will be able to read and reply to this shared conversation.</p>
      <div className="card">
        {loading ? <p className="text-muted">Loading students…</p> : (
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label" htmlFor="student">Community member</label>
              <select id="student" className="form-select" value={studentId} onChange={event => setStudentId(event.target.value)} required>
                <option value="">Choose a community member</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.public_name} {student.role === "student" ? "(Student)" : "(BSC member)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="title">Conversation title</label>
              <input id="title" className="form-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="body">First message</label>
              <textarea id="body" className="form-textarea" value={body} onChange={event => setBody(event.target.value)} maxLength={10000} required />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={saving || !students.length}>
              {saving ? "Creating…" : "Create Conversation"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
