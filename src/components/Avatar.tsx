import type { ReactNode } from "react";
import { FeatureIcon } from "@/components/FeatureIcon";
import type { AvatarId } from "@/lib/identity";

interface AvatarProps {
  name?: string | null;
  avatarId?: string | null;
  size?: "small" | "medium" | "large";
  anonymous?: boolean;
}

const AVATAR_ART: Record<AvatarId, { color: string; accent: string; art: ReactNode }> = {
  "lavender-cat": { color: "#EDE9FE", accent: "#8B5CF6", art: <><path d="M8 10 6 5l5 3m5 2 2-5-5 3" /><ellipse cx="12" cy="13" rx="6" ry="5" /><circle cx="10" cy="12" r=".6" /><circle cx="14" cy="12" r=".6" /><path d="m11 14 1 1 1-1" /></> },
  "sleepy-bear": { color: "#FCE7F3", accent: "#C084FC", art: <><circle cx="7" cy="9" r="2.5" /><circle cx="17" cy="9" r="2.5" /><circle cx="12" cy="13" r="7" /><path d="M9.5 13h1m3 0h1m-4 3q1.5 1 3 0" /></> },
  "soft-fox": { color: "#FFEDD5", accent: "#A855F7", art: <><path d="m7 10-1-5 5 3m6 2 1-5-5 3" /><path d="M6 13a6 6 0 0 1 12 0c0 3-2.7 6-6 6s-6-3-6-6Z" /><path d="m9 14 3 3 3-3-3-2z" /><circle cx="9.5" cy="12" r=".5" /><circle cx="14.5" cy="12" r=".5" /></> },
  "cloud-bunny": { color: "#E0E7FF", accent: "#7C3AED", art: <><ellipse cx="9" cy="6.5" rx="2" ry="4" /><ellipse cx="15" cy="6.5" rx="2" ry="4" /><ellipse cx="12" cy="14" rx="7" ry="6" /><circle cx="9.5" cy="13" r=".6" /><circle cx="14.5" cy="13" r=".6" /><path d="M11 15h2m-1 0v1.5" /></> },
  "little-owl": { color: "#F3E8FF", accent: "#7E22CE", art: <><path d="m6 10 1-5 4 3m6 2-1-5-4 3" /><ellipse cx="12" cy="13.5" rx="7" ry="7" /><circle cx="9.5" cy="12.5" r="2" /><circle cx="14.5" cy="12.5" r="2" /><circle cx="9.5" cy="12.5" r=".6" /><circle cx="14.5" cy="12.5" r=".6" /><path d="m11 15 1 1 1-1" /></> },
  "sunny-flower": { color: "#FCE7F3", accent: "#A855F7", art: <><path d="M12 13v7m0-4c-2-2-4-1-4-1 1 2 2 3 4 2m0-1c2-2 4-1 4-1-1 2-2 3-4 2" /><circle cx="12" cy="9" r="3" /><circle cx="12" cy="4.5" r="2" /><circle cx="16.5" cy="9" r="2" /><circle cx="7.5" cy="9" r="2" /><circle cx="12" cy="13.5" r="2" /><circle cx="12" cy="9" r=".7" /></> },
  "tiny-cactus": { color: "#DCFCE7", accent: "#7E22CE", art: <><path d="M9 20V8a3 3 0 0 1 6 0v12m-6-7H7a2 2 0 0 1-2-2V9m10 5h2a2 2 0 0 0 2-2V9" /><circle cx="10.5" cy="9" r=".5" /><circle cx="13.5" cy="9" r=".5" /><path d="M11 12h2" /></> },
  "moon-panda": { color: "#EDE9FE", accent: "#6D28D9", art: <><circle cx="7" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><ellipse cx="12" cy="13" rx="7" ry="6" /><ellipse cx="9.5" cy="12" rx="1.8" ry="2.2" /><ellipse cx="14.5" cy="12" rx="1.8" ry="2.2" /><circle cx="9.5" cy="12" r=".6" /><circle cx="14.5" cy="12" r=".6" /><path d="M11 15q1 1 2 0" /></> },
};

export function Avatar({ name, avatarId = "lavender-cat", size = "medium", anonymous = false }: AvatarProps) {
  const avatar = AVATAR_ART[avatarId as AvatarId] ?? AVATAR_ART["lavender-cat"];
  const label = anonymous ? "Anonymous member" : `${name || "Member"} avatar`;

  return (
    <span className={`avatar avatar-${size}`} role="img" aria-label={label} style={{ backgroundColor: avatar.color, color: avatar.accent }}>
      {anonymous ? <FeatureIcon name="user" size={size === "small" ? 16 : 20} /> : (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{avatar.art}</svg>
      )}
    </span>
  );
}
