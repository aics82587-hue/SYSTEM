import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { DashboardFeatureCard } from "@/components/DashboardFeatureCard";
import { getGreeting } from "@/lib/greeting";
import Link from "next/link";

export default async function CommunityDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("public_name, role, position, avatar_id")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "community_member") redirect("/login");

  return (
    <>
      <Navbar role="community_member" nickname={profile.public_name} avatarId={profile.avatar_id} showBack={false} />
      <div className="dashboard-layout">
        <Sidebar role="community_member" nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          <PageHeader
            eyebrow="BSC community support space"
            title={<>{getGreeting()}, {profile.public_name ?? "there"} 👋</>}
            description={`${profile.position ?? "BSC Community Member"} · Share, learn, and find support at your own pace.`}
            actions={
              <div className="dashboard-shortcuts">
                <Link href="/student/threads" className="dashboard-icon-link" aria-label="Conversations" title="Conversations">
                  <span aria-hidden="true">💬</span>
                </Link>
                <Link href="/student/group-chat" className="dashboard-icon-link" aria-label="Group chats" title="Group chats">
                  <span aria-hidden="true">👥</span>
                </Link>
              </div>
            }
          />
          <div className="dashboard-feature-grid">
            <DashboardFeatureCard href="/student/messages" icon="message" title="Messages"
              description="Reach out to the Guidance Counselor privately." />
            <DashboardFeatureCard href="/student/threads" icon="conversations" title="Conversations"
              description="Write privately and choose when to share." />
            <DashboardFeatureCard href="/student/group-chat" icon="users" title="Group Chats"
              description="Connect in supportive spaces." />
            <DashboardFeatureCard href="/focus-groups" icon="heart" title="Focus Groups"
              description="Explore groups around shared experiences." />
            <DashboardFeatureCard href="/freedom-wall" icon="board" title="Community Board"
              description="Share a thought or encouragement." />
            <DashboardFeatureCard href="/student/games" icon="game" title="Wellness Games"
              description="Try a grounding or calming activity." />
            <DashboardFeatureCard href="/settings" icon="settings" title="Settings"
              description="Manage your account and preferences." />
          </div>
        </main>
      </div>
    </>
  );
}
