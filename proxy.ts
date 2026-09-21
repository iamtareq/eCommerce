import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic admin check: bounce requests without a session cookie to the
 * login page. The real session validation happens in the admin layout,
 * every server action and every admin route handler.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("dbx_admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
