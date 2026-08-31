import { ForgotPasswordForm, unauth } from "@/features/auth";

export default async function ForgotPasswordPage() {
  await unauth();

  return <ForgotPasswordForm />;
}
