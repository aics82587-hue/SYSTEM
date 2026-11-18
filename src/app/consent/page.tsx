"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ConsentForm } from "@/components/ConsentForm";
import { CONSENT_VERSION, EMPTY_CONSENT_CHOICES, type ConsentChoices } from "@/lib/consent";
import { useToast } from "@/components/ToastProvider";
import { getErrorMessage } from "@/lib/errors";

export default function ConsentPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [choices, setChoices] = useState<ConsentChoices>(EMPTY_CONSENT_CHOICES);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function verifySession() {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) router.replace("/login");
    }
    void verifySession();
  }, [router]);

  async function acceptConsent() {
    if (!acknowledged) {
      showToast("Review the form and choose I Agree before continuing.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again to continue.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (profileError) throw profileError;

      const { error } = await supabase.rpc("record_consent", {
        _version: CONSENT_VERSION,
        _choices: choices,
        _event_type: "accepted",
      });
      if (error) throw error;
      const destination = profile.role === "counselor"
        ? "/counselor"
        : profile.role === "community_member" ? "/community"
        : profile.role === "moderator" ? "/moderator" : "/student";
      router.replace(destination);
    } catch (error: unknown) {
      const detail = getErrorMessage(error, "Please try again.");
      const setupHint = detail.toLowerCase().includes("record_consent")
        ? " If the database function is missing, run migrations 009 and 010 separately, in that order."
        : "";
      showToast(`Could not save your consent: ${detail}${setupHint}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page consent-page">
      <Link href="/logout" className="btn btn-ghost btn-sm">Sign out</Link>
      <ConsentForm choices={choices} onChange={next => { setChoices(next); setAcknowledged(false); }}
        acknowledged={acknowledged} onAcknowledge={() => setAcknowledged(true)} />
      <button type="button" className="btn btn-primary consent-continue" onClick={() => void acceptConsent()}
        disabled={saving || !acknowledged}>
        {saving ? "Saving consent…" : "Save consent and continue"}
      </button>
    </main>
  );
}
