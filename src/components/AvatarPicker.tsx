"use client";

import { Avatar } from "@/components/Avatar";
import { AVATAR_OPTIONS, type AvatarId } from "@/lib/identity";

export function AvatarPicker({
  value,
  onChange,
  label = "Choose an avatar",
}: {
  value: string;
  onChange: (avatarId: AvatarId) => void;
  label?: string;
}) {
  return (
    <fieldset className="avatar-picker">
      <legend className="form-label">{label}</legend>
      <div className="avatar-picker-options">
        {AVATAR_OPTIONS.map(avatar => (
          <button key={avatar.id} type="button" className={`avatar-choice${value === avatar.id ? " selected" : ""}`}
            onClick={() => onChange(avatar.id)} aria-pressed={value === avatar.id} aria-label={avatar.label} title={avatar.label}>
            <Avatar avatarId={avatar.id} name={avatar.label} size="large" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
