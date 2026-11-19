"use client";

import { LoginSplit } from "@/components/arc/blocks/login-split/login-split";
import { loginWithPassword } from "../actions/auth";

export function LoginClient({ next }: { next: string }) {
  return (
    <LoginSplit
      fullScreen
      brand="Team tracker"
      providers={[]}
      showSignUp={false}
      verifyPassword={(email, password) => loginWithPassword(email, password)}
      onSignIn={() => { window.location.assign(next); }}
    />
  );
}
