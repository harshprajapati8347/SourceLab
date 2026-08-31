import { Suspense } from "react";
import { SignupForm, unauth } from "@/features/auth";

export default async function SignupPage() {
  await unauth();

  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
