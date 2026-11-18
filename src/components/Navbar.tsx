import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackToDashboard } from "@/components/BackToDashboard";
import { Avatar } from "@/components/Avatar";
import { FeatureIcon } from "@/components/FeatureIcon";
import { BrainLogo } from "@/components/BrainLogo";
import type { AppRole } from "@/lib/identity";
import { dashboardPathForRole } from "@/lib/identity";

interface Props {
  role: AppRole;
  nickname?: string;
  avatarId?: string | null;
  showBack?: boolean;
  showThemeToggle?: boolean;
}

export function Navbar({ role, nickname, avatarId, showBack = true, showThemeToggle = true }: Props) {
  return (
    <header className="navbar">
      <div className="navbar-leading">
        <Link href={dashboardPathForRole(role)} className="nav-brand">
          <BrainLogo size={21} />
          <span>MenTalks</span>
        </Link>
        {showBack && <BackToDashboard role={role} compact />}
      </div>
      <nav className="nav-links" aria-label="Top navigation">
        {showThemeToggle && <ThemeToggle />}
        {(role === "student" || role === "community_member") && (
          <details className="nav-help">
            <summary title="Need help now?"><FeatureIcon name="life-buoy" size={18} /><span>Need help now?</span></summary>
            <div className="nav-help-panel">
              <strong>Support is here.</strong>
              <p>If you are in immediate danger, contact local emergency services or a trusted person nearby.</p>
              <Link href="/student/messages" className="btn btn-primary btn-sm">Message a counselor</Link>
            </div>
          </details>
        )}
        {nickname ? (
          <details className="profile-menu">
            <summary><Avatar name={nickname} avatarId={avatarId} size="small" /><span className="nav-user">{nickname}</span></summary>
            <div className="profile-menu-panel">
              <span className="profile-menu-role">{role.replace("_", " ")}</span>
              <Link href="/settings">Account settings</Link>
              <a href="/logout">Sign out</a>
            </div>
          </details>
        ) : (
          <>
            <Link href="/settings" className="btn btn-ghost btn-sm">Settings</Link>
            <a href="/logout" className="btn btn-ghost btn-sm nav-signout">Sign out</a>
          </>
        )}
      </nav>
    </header>
  );
}
