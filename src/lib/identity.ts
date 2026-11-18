export const AVATAR_OPTIONS = [
  { id: "lavender-cat", label: "Lavender cat" },
  { id: "sleepy-bear", label: "Sleepy bear" },
  { id: "soft-fox", label: "Soft fox" },
  { id: "cloud-bunny", label: "Cloud bunny" },
  { id: "little-owl", label: "Little owl" },
  { id: "sunny-flower", label: "Sunny flower" },
  { id: "tiny-cactus", label: "Tiny cactus" },
  { id: "moon-panda", label: "Moon panda" },
] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number]["id"];
export type AppRole = "student" | "counselor" | "moderator" | "community_member";

export function dashboardPathForRole(role: AppRole): string {
  return role === "community_member" ? "/community" : `/${role}`;
}

const BLOCKED_PEN_NAME_TERMS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "slut", "whore", "cunt",
  "dick", "pussy", "nigger", "faggot", "admin", "moderator", "counselor",
  "guidance", "official", "anonymous", "support",
];

function normalizeIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function validatePenName(candidate: string): string | null {
  const trimmed = candidate.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return "Use 3 to 32 characters.";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(trimmed)) return "Use letters, numbers, spaces, dots, dashes, or underscores.";
  const normalized = normalizeIdentity(trimmed);
  if (BLOCKED_PEN_NAME_TERMS.some(term => normalized.includes(term))) return "That pen name is not available. Please choose another.";
  return null;
}
