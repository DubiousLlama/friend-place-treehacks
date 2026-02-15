import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Allow only relative paths to prevent open redirect. */
function safeRedirectPath(next: string): string {
  const s = next.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) {
    return "/";
  }
  return s;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next") ?? "/");
  const origin = requestUrl.origin;

  const redirectUrl = `${origin}${next}`;
  const response = NextResponse.redirect(redirectUrl);

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.redirect(`${origin}/?error=config`);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  return response;
}
