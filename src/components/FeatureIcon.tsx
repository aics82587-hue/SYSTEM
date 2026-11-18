import type { ReactNode } from "react";

export type FeatureIconName =
  | "arrow-left"
  | "board"
  | "brain"
  | "calendar"
  | "conversations"
  | "game"
  | "heart"
  | "home"
  | "life-buoy"
  | "message"
  | "notes"
  | "settings"
  | "shield"
  | "sparkles"
  | "user"
  | "users";

const icons: Record<FeatureIconName, ReactNode> = {
  "arrow-left": <path d="m15 18-6-6 6-6M9 12h12M3 5v14" />,
  board: <><path d="M4 5h16v13H4zM8 9h8M8 13h5" /><path d="M8 18v2m8-2v2" /></>,
  brain: <><path d="M12 5.5a3.5 3.5 0 0 0-6.7 1.4A3.5 3.5 0 0 0 4 13a3.5 3.5 0 0 0 2.2 5.6A3.5 3.5 0 0 0 12 20" /><path d="M12 5.5a3.5 3.5 0 0 1 6.7 1.4A3.5 3.5 0 0 1 20 13a3.5 3.5 0 0 1-2.2 5.6A3.5 3.5 0 0 1 12 20M12 4v16M7.5 9.5h2M14.5 9.5h2M7.5 14.5h2M14.5 14.5h2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  conversations: <><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 21l1.5-4A8.3 8.3 0 1 1 21 11.5Z" /><path d="M8 11h8M8 14h5" /></>,
  game: <><path d="M6 9h12a4 4 0 0 1 3.8 5l-1 3a2 2 0 0 1-3.2 1L15 16H9l-2.6 2a2 2 0 0 1-3.2-1l-1-3A4 4 0 0 1 6 9Z" /><path d="M7 12v4m-2-2h4m7-1h.01M18 15h.01" /></>,
  heart: <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" />,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></>,
  "life-buoy": <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="m5.6 5.6 4.3 4.3m4.2 4.2 4.3 4.3m0-12.8-4.3 4.3m-4.2 4.2-4.3 4.3" /></>,
  message: <><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 21l1.5-4A8.3 8.3 0 1 1 21 11.5Z" /><path d="M8 12h8" /></>,
  notes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.8-.6a8 8 0 0 1-1.8 1l-.3 1.9h-3l-.3-1.9a8 8 0 0 1-1.8-1l-1.8.6-1.5-2.6 1.5-1.2a7 7 0 0 1 0-2.1l-1.5-1.2 1.5-2.6 1.8.6a8 8 0 0 1 1.8-1l.3-1.9h3l.3 1.9a8 8 0 0 1 1.8 1l1.8-.6 1.5 2.6-1.5 1.2a7 7 0 0 1 0 2.1Z" transform="translate(-1 -1) scale(1.08)" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.1L22 17l-1.9.9L19 20l-1-2.1-2-.9 2-.9 1-2.1ZM5 3l.8 1.7L7.5 5.5l-1.7.8L5 8l-.8-1.7-1.7-.8 1.7-.8L5 3Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
};

export function FeatureIcon({ name, size = 22 }: { name: FeatureIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}
