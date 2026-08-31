"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { resetPassword } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: resetError } = await resetPassword({
      newPassword: password,
      token,
    });

    if (resetError) {
      setError(resetError.message ?? "Could not reset your password.");
      setIsLoading(false);
      return;
    }

    router.push(authRoutes.login);
    router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>
            Enter a new password for your SourceLab account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <FieldGroup className="gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-new-password">Confirm password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>
              {error ? (
                <p className="text-center text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !token}
              >
                {isLoading ? <Spinner /> : null}
                Update password
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
        </CardContent>
      </Card>
    </div>
  );
}
