import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
