"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { BackToDashboard } from "@/components/BackToDashboard";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";

interface Group { id: string; title: string; description: string; member_count?: number; is_member?: boolean; }
type Role = "student" | "counselor" | "moderator";

export default function FocusGroupsPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role === "student" || profile?.role === "counselor" || profile?.role === "moderator") {
        setRole(profile.role);
      }

      const { data: allGroups } = await supabase.from("focus_groups").select("*");
      const { data: memberships } = await supabase.from("focus_group_members").select("group_id").eq("user_id", user.id);
      const memberSet = new Set(memberships?.map(m => m.group_id) ?? []);

      setGroups((allGroups ?? []).map(g => ({ ...g, is_member: memberSet.has(g.id) })));
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleJoin(groupId: string, isMember: boolean) {
    setJoining(groupId);
    try {
      const supabase = createClient();
      if (isMember) {
        const { error } = await supabase.from("focus_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
        if (error) throw error;
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, is_member: false } : g));
        showToast("Left group.", "info");
      } else {
        const { error } = await supabase.from("focus_group_members").insert({ group_id: groupId, user_id: userId });
        if (error) throw error;
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, is_member: true } : g));
        showToast("Joined group!", "success");
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally { setJoining(null); }
  }

  return (
    <main className="page" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="focus-groups-header">
        <BackToDashboard role={role} compact />
        <PageHeader title="Focus Groups" description="Find a supportive space around shared experiences." />
      </div>

      {loading ? (
        <div className="grid-2" role="status" aria-busy="true" aria-label="Loading focus groups">
          {[0, 1, 2, 3].map(item => (
            <div className="card skeleton-group-card" key={item}>
              <Skeleton width="44px" height="44px" circle />
              <Skeleton width="65%" height="1rem" />
              <Skeleton width="92%" height="0.8rem" />
              <Skeleton width="78%" height="0.8rem" />
            </div>
          ))}
          <span className="sr-only">Loading focus groups…</span>
        </div>
      ) : !groups.length ? (
        <EmptyState icon="users" title="No groups yet" description="Focus groups will appear here once created." />
      ) : (
        <div className="grid-2">
          {groups.map(g => (
            <div key={g.id} className="card focus-group-card">
              <div className="focus-group-heading">
                <Avatar name={g.title} size="medium" />
                <div>
                  <h3 style={{ marginBottom: "0.25rem" }}>{g.title}</h3>
                <p className="text-muted" style={{ fontSize: "0.9rem" }}>{g.description}</p>
                </div>
              </div>
              <div className="focus-group-actions">
                {g.is_member && (
                  <Link href={`/focus-groups/${g.id}`} className="btn btn-primary btn-sm">Open Group</Link>
                )}
                {role !== "counselor" && <button
                  className={`btn btn-sm ${g.is_member ? "btn-secondary" : "btn-primary"}`}
                  disabled={joining === g.id}
                  onClick={() => toggleJoin(g.id, !!g.is_member)}
                >
                  {joining === g.id
                    ? <span className="spinner" style={{ width: 14, height: 14 }} />
                    : g.is_member ? "Leave" : "Join"}
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
