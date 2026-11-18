"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConsentForm } from "@/components/ConsentForm";
import { CounselorAcknowledgmentForm } from "@/components/CounselorAcknowledgmentForm";
import { useToast } from "@/components/ToastProvider";
import {
  EMPTY_COUNSELOR_ACKNOWLEDGMENT,
  type CounselorAcknowledgmentStatements,
} from "@/lib/counselor-acknowledgment";
import { EMPTY_CONSENT_CHOICES, type ConsentChoices } from "@/lib/consent";

type AccountRole = "student" | "counselor" | "community_member" | "moderator";

function isAccountRole(value: unknown): value is AccountRole {
  return value === "student" || value === "counselor"
    || value === "community_member" || value === "moderator";
}

export default function ConsentPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [role, setRole] = useState<AccountRole | null>(null);
  const [pageError, setPageError] = useState("");
  const [choices, setChoices] = useState<ConsentChoices>(EMPTY_CONSENT_CHOICES);
  const [statements, setStatements] = useState<CounselorAcknowledgmentStatements>(
    EMPTY_COUNSELOR_ACKNOWLEDGMENT,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadRole() {
      try {
        const response = await fetch("/api/consent", { cache: "no-store" });
        const result = await response.json() as { role?: unknown; error?: string };
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(result.error || "Could not verify your account.");
        if (!isAccountRole(result.role)) throw new Error("Your account role could not be verified.");
        if (active) setRole(result.role);
      } catch (error: unknown) {
        if (active) {
          setPageError(error instanceof Error ? error.message : "Could not load this page. Please try again.");
        }
      }
    }
    void loadRole();
    return () => { active = false; };
  }, [router]);

  async function saveAndContinue() {
    if (!role || saving) return;
    if (!acknowledged) {
      showToast(
        role === "counselor"
          ? "Review each responsibility and choose I Acknowledge before continuing."
          : "Review the form and choose I Agree before continuing.",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = role === "counselor"
        ? { type: "counselor_acknowledgment", statements }
        : { type: "student_consent", choices };
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { destination?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      router.replace(result.destination || (role === "counselor" ? "/counselor" : "/student"));
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "Please try again.";
      const prefix = role === "counselor"
        ? "Could not save your acknowledgment: "
        : "Could not save your consent: ";
      showToast(`${prefix}${detail}`, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!role) {
    return (
      <main className="page consent-page">
        <Link href="/logout" className="btn btn-ghost btn-sm">Sign out</Link>
        {pageError
          ? <p className="notice notice-danger" role="alert">{pageError}</p>
          : <p role="status">Loading your form…</p>}
      </main>
    );
  }

  const isCounselor = role === "counselor";

  return (
    <main className="page consent-page">
      <Link href="/logout" className="btn btn-ghost btn-sm">Sign out</Link>
      {isCounselor ? (
        <CounselorAcknowledgmentForm
          statements={statements}
          onChange={(next) => {
            setStatements(next);
            setAcknowledged(false);
          }}
          acknowledged={acknowledged}
          onAcknowledge={() => setAcknowledged(true)}
        />
      ) : (
        <ConsentForm
          choices={choices}
          onChange={(next) => {
            setChoices(next);
            setAcknowledged(false);
          }}
          acknowledged={acknowledged}
          onAcknowledge={() => setAcknowledged(true)}
        />
      )}
      <button
        type="button"
        className="btn btn-primary consent-continue"
        onClick={() => void saveAndContinue()}
        disabled={saving || !acknowledged}
      >
        {saving
          ? isCounselor ? "Saving acknowledgment…" : "Saving consent…"
          : isCounselor ? "Save acknowledgment and continue" : "Save consent and continue"}
      </button>
    </main>
  );
}
