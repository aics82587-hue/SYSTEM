"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

export function ConversationDeleteButton({
  threadId,
}: {
  threadId: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function deleteConversation() {
    if (deleting || !window.confirm(
      "Delete this conversation for both you and the other participant? It will disappear from the app, but its records will remain stored.",
    )) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("threads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", threadId);
      if (error) throw error;
      showToast("Conversation deleted for both participants.", "success");
      router.refresh();
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Could not delete the conversation. Please try again.",
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
      aria-label="Delete this conversation for both participants"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
