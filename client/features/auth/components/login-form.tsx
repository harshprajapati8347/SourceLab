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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toAbsoluteCallbackUrl } from "../lib/callback-url";
import { signIn } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";
import { GoogleIcon } from "./google-icon";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const callbackUrl = searchParams.get("callbackUrl") ?? authRoutes.dashboard;
  const isLoading = isGoogleLoading || isEmailLoading;

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    setError(null);

    const { data, error: signInError } = await signIn.social({
      provider: "google",
      callbackURL: toAbsoluteCallbackUrl(callbackUrl),
    });

    if (signInError) {
      setError(signInError.message ?? "Something went wrong. Please try again.");
      setIsGoogleLoading(false);
      return;
    }

    if (data?.url && data.redirect) {
      window.location.href = data.url;
      return;
    }

    setIsGoogleLoading(false);
  }

  async function handleEmailSignIn(event: React.FormEvent) {
    event.preventDefault();
    setIsEmailLoading(true);
    setError(null);

    const { error: signInError } = await signIn.email({
      email: email.trim(),
      password,
      callbackURL: toAbsoluteCallbackUrl(callbackUrl),
    });

    if (signInError) {
      setError(signInError.message ?? "Could not sign in. Please try again.");
      setIsEmailLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with Google or email to continue to SourceLab AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isLoading}
                onClick={() => void handleGoogleSignIn()}
              >
                {isGoogleLoading ? <Spinner /> : <GoogleIcon />}
                Continue with Google
              </Button>
            </Field>
            <FieldSeparator>or</FieldSeparator>
            <form onSubmit={(event) => void handleEmailSignIn(event)}>
              <FieldGroup className="gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href={authRoutes.forgotPassword}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                </div>
                {error ? (
                  <p className="text-center text-sm text-destructive">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isEmailLoading ? <Spinner /> : null}
                  Sign in
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link
                    href={authRoutes.signup}
                    className="underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
