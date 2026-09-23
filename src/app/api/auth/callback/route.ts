import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const safeOrigin = origin.replace("0.0.0.0", "localhost");
  const code = searchParams.get("code");
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const cookieNext = request.cookies.get("auth_redirect_next")?.value;
  const rawNext = searchParams.get("next") ?? (cookieNext ? decodeURIComponent(cookieNext) : "/");

  // Защита от Open Redirect (только безопасные относительные пути)
  const isSafeRelative =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/\\") &&
    !rawNext.includes("\\") &&
    !rawNext.includes("://");
  const safeNext = isSafeRelative ? rawNext : "/";

  // Обработка прямой передачи токенов через query: перенаправляем на safeOrigin с hash
  if (accessToken && refreshToken) {
    return NextResponse.redirect(
      `${safeOrigin}${safeNext}#access_token=${accessToken}&refresh_token=${refreshToken}`
    );
  }

  if (code) {
    let response = NextResponse.redirect(`${safeOrigin}${safeNext}`);
    // Очищаем куку после использования
    response.cookies.set("auth_redirect_next", "", { path: "/", maxAge: 0 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://npcayouvvwjaqxqgxqxc.supabase.co";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

  // Если код отсутствует или произошла ошибка — перенаправляем на safeNext
  return NextResponse.redirect(`${safeOrigin}${safeNext}`);
}
