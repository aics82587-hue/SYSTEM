import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AppointmentBody = {
  date?: unknown;
  time?: unknown;
  notes?: unknown;
};

async function getStudentClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Your session expired. Please sign in again." },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Could not verify appointment requester role:", profileError.message);
    return {
      error: NextResponse.json(
        { error: "Could not verify your account. Please try again." },
        { status: 500 },
      ),
    };
  }
  if (profile?.role !== "student") {
    return {
      error: NextResponse.json(
        { error: "Only student accounts can request an appointment." },
        { status: 403 },
      ),
    };
  }

  return { supabase, user };
}

export async function GET() {
  const account = await getStudentClient();
  if ("error" in account) return account.error;

  const { data, error } = await account.supabase
    .from("appointments")
    .select("id, requested_at, notes, status")
    .eq("student_id", account.user.id)
    .order("requested_at", { ascending: false });
  if (error) {
    console.error("Could not load student appointments:", error.message);
    return NextResponse.json(
      { error: "Could not load your appointment requests. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const account = await getStudentClient();
  if ("error" in account) return account.error;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The appointment request was not valid. Please try again." },
      { status: 400 },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "The appointment request was not valid. Please try again." },
      { status: 400 },
    );
  }
  const body = payload as AppointmentBody;

  if (
    typeof body.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
    typeof body.time !== "string" ||
    !/^\d{2}:\d{2}$/.test(body.time)
  ) {
    return NextResponse.json(
      { error: "Choose a valid date and time for your appointment." },
      { status: 400 },
    );
  }

  const [year, month, day] = body.date.split("-").map(Number);
  const [hour, minute] = body.time.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return NextResponse.json(
      { error: "Choose a valid date and time for your appointment." },
      { status: 400 },
    );
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 2000) {
    return NextResponse.json(
      { error: "Keep appointment notes under 2,000 characters." },
      { status: 400 },
    );
  }

  const requestedAt = new Date(`${body.date}T${body.time}:00+08:00`);
  if (!Number.isFinite(requestedAt.getTime()) || requestedAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Choose a future date and time for your appointment." },
      { status: 400 },
    );
  }

  const { data, error } = await account.supabase
    .from("appointments")
    .insert({
      student_id: account.user.id,
      requested_at: requestedAt.toISOString(),
      notes,
      status: "pending",
    })
    .select("id, requested_at, notes, status")
    .single();
  if (error) {
    console.error("Could not save student appointment request:", error.message);
    return NextResponse.json(
      { error: "Your appointment request could not be saved. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
