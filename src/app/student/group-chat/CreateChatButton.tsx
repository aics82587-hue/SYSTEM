"use client";

import { useState } from "react";
import { CreateGroupChatModal } from "./CreateGroupChatModal";

interface Props {
  currentUserId: string;
}

export function CreateChatButton({ currentUserId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn btn-primary btn-sm"
        title="Create a new group chat with classmates"
        aria-label="Create new group chat"
      >
        <span title="New chat" role="img" aria-hidden="true">
          ➕
        </span>
        Create New Group Chat
      </button>

      <CreateGroupChatModal
        currentUserId={currentUserId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
