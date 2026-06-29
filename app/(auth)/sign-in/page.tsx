"use client";

import { useState } from "react";
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  return (
    <>
      {mode === "sign-in" ? (
        <SignInForm onSwitchToSignUp={() => setMode("sign-up")} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setMode("sign-in")} />
      )}
    </>
  );
}
