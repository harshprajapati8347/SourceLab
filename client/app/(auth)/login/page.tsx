import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { unauth } from "@/lib/unauth";

export default async function LoginPage() {
  await unauth();

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
