import { Suspense } from "react";
import SignInForm from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
