import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Auth gate. Anyone hitting any URL that isn't /login or a public share
// link gets bounced to /login until they sign in. The session is read
// from the auth cookies @supabase/ssr writes from the client side.
//
// Next 16 renamed the file convention from `middleware.ts` to
// `proxy.ts` and the export from `middleware` to `proxy`.

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const isPublicShare = path.startsWith("/share/");

  // Unauthenticated users hitting anything but /login or /share/* → /login.
  if (!user && !isLoginPage && !isPublicShare) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Already-signed-in users on /login → home.
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip Next internals, static files, and the API routes (those are
  // protected by their own logic / Anthropic-only writes).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
