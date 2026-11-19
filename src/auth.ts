import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getMemberForLogin } from "@/lib/db";

const credentials = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const member = await getMemberForLogin(parsed.data.email);
        if (!member?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, member.passwordHash);
        return ok ? { id: member.id, name: member.name, email: member.email, isAdmin: member.isAdmin } : null;
      },
    }),
  ],
});
