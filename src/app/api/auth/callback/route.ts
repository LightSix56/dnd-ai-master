import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function sanitizeRelativeRedirect(raw: string | null | undefined): string {
  if (!raw) return "/";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  const isSafeRelative =
    decoded.startsWith("/") &&
    !decoded.startsWith("//") &&
    !decoded.startsWith("/\\") &&
    !decoded.includes("\\") &&
    !decoded.includes("://") &&
    !/[\x00-\x1f\x7f]/.test(decoded);
  return isSafeRelative ? decoded : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const safeOrigin = origin.replace("0.0.0.0", "localhost");
  const code = searchParams.get("code");
  const cookieNext = request.cookies.get("auth_redirect_next")?.value;
  const safeNext = sanitizeRelativeRedirect(searchParams.get("next") ?? cookieNext);

  if (code) {
    const response = NextResponse.redirect(`${safeOrigin}${safeNext}`);
    response.cookies.set("auth_redirect_next", "", { path: "/", maxAge: 0 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (url && anonKey) {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return response;
      }
      console.error("[Auth Callback] Error exchanging code for session:", error.message);
    }
  }

  return NextResponse.redirect(`${safeOrigin}${safeNext}`);
}
