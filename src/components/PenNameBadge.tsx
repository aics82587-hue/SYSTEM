import { Avatar } from "@/components/Avatar";

export function PenNameBadge({
  name,
  avatarId,
  role,
  position,
  compact = false,
}: {
  name: string;
  avatarId?: string | null;
  role?: string | null;
  position?: string | null;
  compact?: boolean;
}) {
  const isCounselor = role === "counselor";
  return (
    <span className={`identity-badge${compact ? " identity-badge-compact" : ""}`}>
      <Avatar name={name} avatarId={avatarId} size="small" />
      <span className="identity-badge-copy">
        <span className="identity-badge-name">{name}</span>
        {isCounselor ? (
          <>
            <span className="identity-badge-position">{position ?? "Guidance Counselor"}</span>
            <span className="verified-counselor-badge" title="Verified Guidance Counselor">Verified Counselor</span>
          </>
        ) : position ? <span className="identity-badge-position">{position}</span> : null}
      </span>
    </span>
  );
}
