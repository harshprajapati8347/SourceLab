"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toAbsoluteCallbackUrl } from "../lib/callback-url";
import { requestPasswordReset } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error: resetError } = await requestPasswordReset({
      email: email.trim(),
      redirectTo: toAbsoluteCallbackUrl(authRoutes.resetPassword),
    });

    if (resetError) {
      setError(resetError.message ?? "Could not send a reset email.");
      setIsLoading(false);
      return;
    }

    setSent(true);
    setIsLoading(false);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset password</CardTitle>
          <CardDescription>
            {sent
              ? "If an account exists for that email, we sent a reset link."
              : "Enter your email and we will send a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Button
              nativeButton={false}
              variant="outline"
              className="w-full"
              render={<Link href={authRoutes.login} />}
            >
              Back to sign in
            </Button>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)}>
              <FieldGroup className="gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                {error ? (
                  <p className="text-center text-sm text-destructive">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Spinner /> : null}
                  Send reset link
                </Button>
                <FieldDescription className="text-center">
                  <Link
                    href={authRoutes.login}
                    className="underline underline-offset-4"
                  >
                    Back to sign in
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
