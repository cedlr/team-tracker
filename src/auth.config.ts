import type { NextAuthConfig } from "next-auth";

/** Edge-safe part of the auth config, shared by proxy.ts and auth.ts. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/login")) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) { token.sub = user.id; token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false; }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) { session.user.id = token.sub; (session.user as { isAdmin?: boolean }).isAdmin = Boolean(token.isAdmin); }
      return session;
    },
  },
} satisfies NextAuthConfig;
