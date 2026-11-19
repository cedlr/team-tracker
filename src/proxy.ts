import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { TEAM_COOKIE } from "@/lib/team-cookie";

const { auth } = NextAuth(authConfig);

/** Protects the app routes and turns ?team=<id> into the team cookie. */
export const proxy = auth(request => {
  const path = request.nextUrl.pathname;
  if (!request.auth && !path.startsWith("/login")) {
    const url = new URL("/login", request.nextUrl);
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (request.auth && path === "/login") return NextResponse.redirect(new URL("/", request.nextUrl));
  const team = request.nextUrl.searchParams.get("team");
  if (team) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("team");
    const response = NextResponse.redirect(url);
    response.cookies.set(TEAM_COOKIE, team, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
    return response;
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|media|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
