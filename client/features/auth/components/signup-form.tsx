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
import { signIn, signUp } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";
import { GoogleIcon } from "./google-icon";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isLoading = isGoogleLoading || isEmailLoading;

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    setError(null);

    const { data, error: signInError } = await signIn.social({
      provider: "google",
      callbackURL: toAbsoluteCallbackUrl(authRoutes.dashboard),
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

  async function handleEmailSignUp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsEmailLoading(true);

    const { error: signUpError } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: toAbsoluteCallbackUrl(authRoutes.dashboard),
    });

    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account.");
      setIsEmailLoading(false);
      return;
    }

    setSuccess(true);
    setIsEmailLoading(false);
  }

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to {email}. Verify your address before
              signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              variant="outline"
              className="w-full"
              render={<Link href={authRoutes.login} />}
            >
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            Sign up with Google or email. Email accounts need verification
            before you can sign in.
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
            <form onSubmit={(event) => void handleEmailSignUp(event)}>
              <FieldGroup className="gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
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
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isEmailLoading ? <Spinner /> : null}
                  Create account
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link
                    href={authRoutes.login}
                    className="underline underline-offset-4"
                  >
                    Sign in
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
