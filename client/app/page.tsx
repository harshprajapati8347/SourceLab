import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authRoutes, getSession } from "@/features/auth";
import { billingRoutes } from "@/features/billing/lib/routes";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(authRoutes.dashboard);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="flex max-w-lg flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          SourceLab AI
        </h1>
        <p className="text-muted-foreground">
          Sign in to start chatting with your documents.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button nativeButton={false} render={<Link href={authRoutes.login} />}>
            Get started
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href={billingRoutes.pricing} />}
          >
            See pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
