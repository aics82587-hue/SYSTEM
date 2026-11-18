import { Avatar } from "@/components/Avatar";

export function ProfileIdentity({
  name,
  position,
  role,
  avatarId,
}: {
  name: string;
  position?: string | null;
  role?: string | null;
  avatarId?: string | null;
}) {
  if (role === "counselor") {
    return (
      <span className="profile-identity counselor-identity">
        <Avatar name={name} avatarId={avatarId} size="small" />
        <span>{name}{position ? `, ${position}` : ", Guidance Counselor"}</span>
        <span className="verified-counselor-badge">Verified Counselor</span>
      </span>
    );
  }
  return <span className="profile-identity"><Avatar name={name} avatarId={avatarId} size="small" /><span>{name}</span></span>;
}
