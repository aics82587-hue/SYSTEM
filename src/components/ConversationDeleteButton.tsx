"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function ConversationDeleteButton({
  threadId,
  viewerRole,
  isShared = false,
}: {
  threadId: string;
  viewerRole: "student" | "counselor";
  isShared?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function deleteConversation() {
    if (deleting) return;
    const confirmation = viewerRole === "student"
      ? `Archive this conversation from your list? ${
          isShared
            ? "Your counselor will still be able to see it."
            : "Its records will remain stored."
        }`
      : "Delete this shared conversation for both participants? Its records will remain stored.";
    if (!window.confirm(confirmation)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: "DELETE",
      });
      const result: unknown = await response.json();
      const errorMessage =
        result &&
        typeof result === "object" &&
        "error" in result &&
        typeof result.error === "string"
          ? result.error
          : null;
      if (!response.ok) {
        throw new Error(errorMessage ?? "Could not update the conversation. Please try again.");
      }
      showToast(
        viewerRole === "student"
          ? "Conversation archived from your list."
          : "Conversation deleted for both participants.",
        "success",
      );
      router.refresh();
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not update the conversation. Please try again.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm text-danger thread-item-delete"
      onClick={() => void deleteConversation()}
      disabled={deleting}
      aria-label={
        viewerRole === "student"
          ? "Archive this conversation from your list"
          : "Delete this conversation for both participants"
      }
    >
      {deleting ? "Saving…" : viewerRole === "student" ? "Archive" : "Delete"}
    </button>
  );
}
