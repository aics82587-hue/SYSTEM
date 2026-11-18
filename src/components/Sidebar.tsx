"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcon";
import { Avatar } from "@/components/Avatar";
import type { AppRole } from "@/lib/identity";

interface Props {
  role: AppRole;
  nickname?: string;
  avatarId?: string | null;
}

interface NavItem {
  label: string;
  href: string;
  icon: FeatureIconName;
}

const NAV: Record<AppRole, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/student", icon: "home" },
    { label: "Messages", href: "/student/messages", icon: "message" },
    { label: "Conversations", href: "/student/threads", icon: "conversations" },
    { label: "My Referrals", href: "/student/referrals", icon: "notes" },
    { label: "Appointments", href: "/student/appointments", icon: "calendar" },
    { label: "Focus Groups", href: "/focus-groups", icon: "users" },
    { label: "Games", href: "/student/games", icon: "game" },
    { label: "Community Board", href: "/freedom-wall", icon: "board" },
    { label: "Calendar", href: "/student/calendar", icon: "calendar" },
  ],
  counselor: [
    { label: "Dashboard", href: "/counselor", icon: "home" },
    { label: "Messages", href: "/counselor/messages", icon: "message" },
    { label: "Conversations", href: "/counselor/threads", icon: "conversations" },
    { label: "Referrals", href: "/counselor/referrals", icon: "notes" },
    { label: "Appointments", href: "/counselor/appointments", icon: "calendar" },
    { label: "Focus Groups", href: "/focus-groups", icon: "users" },
    { label: "Notes", href: "/counselor/notes", icon: "notes" },
    { label: "Calendar", href: "/counselor/calendar", icon: "calendar" },
    { label: "My Status", href: "/counselor/status", icon: "heart" },
    { label: "Support Banner", href: "/counselor/banner", icon: "sparkles" },
  ],
  community_member: [
    { label: "Dashboard", href: "/community", icon: "home" },
    { label: "Messages", href: "/student/messages", icon: "message" },
    { label: "Conversations", href: "/student/threads", icon: "conversations" },
    { label: "Group Chats", href: "/student/group-chat", icon: "users" },
    { label: "Focus Groups", href: "/focus-groups", icon: "users" },
    { label: "Community Board", href: "/freedom-wall", icon: "board" },
    { label: "Games", href: "/student/games", icon: "game" },
    { label: "Settings", href: "/settings", icon: "settings" },
  ],
  moderator: [
    { label: "Dashboard", href: "/moderator", icon: "home" },
    { label: "Reports", href: "/moderator/reports", icon: "shield" },
    { label: "Focus Groups", href: "/focus-groups", icon: "users" },
  ],
};

export function Sidebar({ role, nickname, avatarId }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV[role] ?? [];

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile Hamburger toggle button */}
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        aria-controls="primary-sidebar"
        title={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <span aria-hidden="true" title={mobileOpen ? "Close menu icon" : "Menu icon"}>
          {mobileOpen ? "✕" : "☰"}
        </span>
      </button>

      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main sidebar navigation */}
      <nav
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Sidebar navigation"
        id="primary-sidebar"
      >
        {nickname && (
          <div className="sidebar-profile">
            <Avatar name={nickname} avatarId={avatarId} size="medium" />
            <div className="sidebar-profile-copy">
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Signed in as
            </p>
            <p
              style={{
                fontWeight: 600,
                color: "var(--text-primary)",
                marginTop: "0.15rem",
                wordBreak: "break-word",
              }}
            >
              {nickname}
            </p>
            </div>
            <span
              className={`badge badge-${
                role === "student" || role === "community_member" ? "brand" : role === "counselor" ? "success" : "warning"
              }`}
              style={{ marginTop: "0.4rem" }}
              title={`Role: ${role}`}
            >
              {role.replace("_", " ")}
            </span>
          </div>
        )}

        <div className="sidebar-section">Menu</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", overflowY: "auto" }}>
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`sidebar-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <span className="sidebar-icon"><FeatureIcon name={item.icon} size={19} /></span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: "1rem" }} />

        <a
          href="/logout"
          className="sidebar-item"
          title="Sign out of Mentalks"
          style={{ marginTop: "auto", color: "var(--danger)" }}
        >
          <span className="sidebar-icon" title="Sign out icon" aria-hidden="true">
            🚪
          </span>
          <span>Sign Out</span>
        </a>
      </nav>

      {/* Scoped CSS for mobile toggle and backdrop */}
      <style jsx>{`
        .sidebar-mobile-toggle {
          display: none;
        }

        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(2px);
          z-index: 145;
        }

        @media (max-width: 768px) {
          .sidebar-mobile-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            bottom: 1.25rem;
            left: 1.25rem;
            z-index: 160;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--brand-dark);
            color: #ffffff;
            border: none;
            box-shadow: var(--shadow-md);
            cursor: pointer;
            font-size: 1.3rem;
            transition: transform 0.2s ease, background 0.2s ease;
          }

          .sidebar-mobile-toggle:hover {
            transform: scale(1.05);
            background: var(--brand-dark);
          }

          .sidebar-mobile-toggle:active {
            transform: scale(0.95);
          }
        }
      `}</style>
    </>
  );
}
