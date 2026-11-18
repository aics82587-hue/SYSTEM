import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COUNSELOR_ACKNOWLEDGMENT_VERSION,
  isCompleteCounselorAcknowledgment,
} from "@/lib/counselor-acknowledgment";
import { CONSENT_VERSION, type ConsentChoices } from "@/lib/consent";

type AccountRole = "student" | "counselor" | "community_member" | "moderator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getConsentChoices(value: unknown): ConsentChoices | null {
  if (!isRecord(value)) return null;
  const requiredKeys = [
    "purpose",
    "voluntary",
    "identity_protection",
    "publication_review",
    "referral_sharing",
  ] as const;
  if (
    !requiredKeys.every((key) => value[key] === true) ||
    typeof value.public_release !== "boolean"
  ) {
    return null;
  }
  return {
    purpose: true,
    voluntary: true,
    identity_protection: true,
    publication_review: true,
    referral_sharing: true,
    public_release: value.public_release,
  };
}

function getDestination(role: AccountRole) {
  if (role === "counselor") return "/counselor";
  if (role === "community_member") return "/community";
  if (role === "moderator") return "/moderator";
  return "/student";
}

function acknowledgmentStorageError(code: string | undefined) {
  return code === "42P01" || code === "PGRST205"
    ? "Counselor acknowledgment storage is not ready. Ask an administrator to apply migration 012."
    : "Could not save your acknowledgment. Please try again.";
}

async function getAccount() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return {
      response: NextResponse.json(
        { error: "We could not verify your account role. Please sign out and sign in again." },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    user,
    role: profile.role as AccountRole,
  };
}

export async function GET() {
  const account = await getAccount();
  if ("response" in account) return account.response;
  return NextResponse.json({ role: account.role }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const account = await getAccount();
  if ("response" in account) return account.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The form submission was not valid. Please try again." }, { status: 400 });
  }
  if (!isRecord(payload)) {
    return NextResponse.json({ error: "The form submission was not valid. Please try again." }, { status: 400 });
  }

  if (account.role === "counselor") {
    if (
      payload.type !== "counselor_acknowledgment" ||
      !isCompleteCounselorAcknowledgment(payload.statements)
    ) {
      return NextResponse.json(
        { error: "Please acknowledge each responsibility before continuing." },
        { status: 400 },
      );
    }

    const { data: existing, error: lookupError } = await account.supabase
      .from("counselor_acknowledgments")
      .select("id")
      .eq("user_id", account.user.id)
      .eq("version", COUNSELOR_ACKNOWLEDGMENT_VERSION)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json(
        { error: acknowledgmentStorageError(lookupError.code) },
        { status: 500 },
      );
    }
    if (!existing) {
      const { error: insertError } = await account.supabase
        .from("counselor_acknowledgments")
        .insert({
          user_id: account.user.id,
          role: "counselor",
          version: COUNSELOR_ACKNOWLEDGMENT_VERSION,
          statements: payload.statements,
        });
      if (insertError && insertError.code !== "23505") {
          return NextResponse.json(
            { error: acknowledgmentStorageError(insertError.code) },
            { status: 500 },
          );
      }
    }

    return NextResponse.json({ destination: getDestination(account.role) });
  }

  if (payload.type !== "student_consent") {
    return NextResponse.json({ error: "The form submission is not valid for your account." }, { status: 400 });
  }
  const choices = getConsentChoices(payload.choices);
  if (!choices) {
    return NextResponse.json(
      { error: "Please review each required statement before continuing." },
      { status: 400 },
    );
  }

  const { error } = await account.supabase.rpc("record_consent", {
    _version: CONSENT_VERSION,
    _choices: choices,
    _event_type: "accepted",
  });
  if (error) {
    const detail = error.code === "PGRST202" || error.message.toLowerCase().includes("record_consent")
      ? "Student consent storage is not ready. Ask an administrator to complete migration 010."
      : "Could not save your consent. Please try again.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  return NextResponse.json({ destination: getDestination(account.role) });
}
