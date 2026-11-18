import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";

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

  if (user && isProtected && pathname !== "/consent") {
    const { data: latestConsent, error } = await supabase
      .from("consent_records")
      .select("event_type, version")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || latestConsent?.event_type !== "accepted" || latestConsent.version !== CONSENT_VERSION) {
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
