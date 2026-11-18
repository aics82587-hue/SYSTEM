import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { COUNSELOR_ACKNOWLEDGMENT_VERSION } from "@/lib/counselor-acknowledgment";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const runtime = globalThis as typeof globalThis & {
    process: { env: Record<string, string | undefined> };
  };

  const supabase = createServerClient(
    runtime.process.env.NEXT_PUBLIC_SUPABASE_URL!,
    runtime.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const protectedPaths = [
    "/student",
    "/counselor",
    "/moderator",
    "/community",
    "/settings",
    "/focus-groups",
    "/freedom-wall",
  ];
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!user && (isProtected || pathname === "/consent")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (isProtected || pathname === "/consent")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role as string | undefined;
    let requirementComplete = false;

    if (role === "counselor") {
      const { data: acknowledgment, error } = await supabase
        .from("counselor_acknowledgments")
        .select("id")
        .eq("user_id", user.id)
        .eq("version", COUNSELOR_ACKNOWLEDGMENT_VERSION)
        .maybeSingle();
      requirementComplete = !error && Boolean(acknowledgment);
    } else {
      const { data: latestConsent, error } = await supabase
        .from("consent_records")
        .select("event_type, version")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      requirementComplete = !error
        && latestConsent?.event_type === "accepted"
        && latestConsent.version === CONSENT_VERSION;
    }

    if (pathname === "/consent" && requirementComplete) {
      const url = request.nextUrl.clone();
      url.pathname = role === "counselor" ? "/counselor"
        : role === "community_member" ? "/community"
        : role === "moderator" ? "/moderator"
        : "/student";
      return NextResponse.redirect(url);
    }

    if (isProtected && !requirementComplete) {
      const url = request.nextUrl.clone();
      url.pathname = "/consent";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
