import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function logDatabaseError(action: string, error: {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}) {
  console.error(action, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function databaseFailure(message: string, code?: string) {
  return NextResponse.json(
    { error: `${message}${code ? ` (database code: ${code})` : ""}. Please try again.` },
    { status: 500 },
  );
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    logDatabaseError("Could not verify conversation action role:", profileError);
    return databaseFailure("Could not verify your account", profileError.code);
  }
  if (!profile) {
    return NextResponse.json({ error: "Your account could not be verified." }, { status: 403 });
  }

  if (profile.role === "student" || profile.role === "community_member") {
    const { data: archived, error } = await supabase.rpc("archive_student_thread", {
      _thread_id: id,
    });
    if (error) {
      logDatabaseError("Could not archive student conversation:", error);
      return databaseFailure("Could not archive the conversation", error.code);
    }
    if (!archived) {
      return NextResponse.json(
        { error: "Conversation not found or no longer available." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, action: "archived" });
  }

  if (profile.role === "counselor") {
    const { count, error } = await supabase
      .from("threads")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id)
      .eq("visibility", "shared");
    if (error) {
      logDatabaseError("Could not delete counselor conversation:", error);
      return databaseFailure("Could not delete the conversation", error.code);
    }
    if (count !== 1) {
      return NextResponse.json(
        { error: "Conversation not found or no longer available." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, action: "deleted" });
  }

  return NextResponse.json(
    { error: "Your account is not permitted to update this conversation." },
    { status: 403 },
  );
}
