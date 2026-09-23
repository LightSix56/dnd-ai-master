import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let response = NextResponse.json({ success: true });

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

  await supabase.auth.signOut();

  // Очищаем куки авторизации Supabase
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith("sb-") || name.includes("supabase")) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  });

  return response;
}
