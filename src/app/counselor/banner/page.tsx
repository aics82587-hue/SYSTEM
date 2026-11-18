"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export default function CounselorBannerPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string }>({});
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [bannerId, setBannerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("public_name, avatar_id, role").eq("id", user.id).single();
      if (p?.role !== "counselor") { router.push("/login"); return; }
      setProfile(p);

      const { data } = await supabase.from("support_banner").select("*").order("id", { ascending: false }).limit(1).single();
      if (data) { setContent(data.content ?? ""); setIsActive(data.is_active); setBannerId(data.id); }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      if (bannerId) {
        const { error } = await supabase.from("support_banner").update({ content, is_active: isActive }).eq("id", bannerId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("support_banner").insert({ content, is_active: isActive }).select().single();
        if (error) throw error;
        setBannerId(data.id);
      }
      showToast("Banner saved!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not save banner.", "error");
    } finally { setSaving(false); }
  }

  return (
    <>
      <Navbar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile?.public_name} avatarId={profile?.avatar_id} />
        <main className="dashboard-main" style={{ maxWidth: 640 }}>
          <h1 className="section-title mb-3">Support Banner</h1>
          <p className="text-muted mb-3">This banner appears at the top of every page for all users.</p>

          {loading ? <div className="spinner" style={{ width: 28, height: 28 }} /> : (
            <div className="card">
              <form onSubmit={save}>
                <div className="form-group">
                  <label className="form-label" htmlFor="banner-content">Banner Text</label>
                  <textarea id="banner-content" className="form-textarea"
                    placeholder="e.g. 'If you are in crisis, call 1-800-XXX-XXXX or text HOME to 741741.'"
                    value={content} onChange={e => setContent(e.target.value)} style={{ minHeight: 90 }} />
                  <span className="form-hint">Leave blank to hide the banner.</span>
                </div>
                <div className="checkbox-group" style={{ marginBottom: "1.5rem" }}>
                  <input type="checkbox" id="banner-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                  <label htmlFor="banner-active">Banner is active (visible to all users)</label>
                </div>
                {content && isActive && (
                  <div className="support-banner mb-2">
                    <span className="support-banner-icon">💬</span>
                    <span>{content}</span>
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Save Banner"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
