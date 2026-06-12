import { Suspense } from "react";
import VerifyForm from "./verify-form";

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading...</div>}>
      <VerifyForm />
    </Suspense>
  );
}
