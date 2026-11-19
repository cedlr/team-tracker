"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/** Called by login-split's password step. Sets the session cookie on success. */
export async function loginWithPassword(email: string, password: string): Promise<boolean> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return true;
  } catch (error) {
    if (error instanceof AuthError) return false;
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
