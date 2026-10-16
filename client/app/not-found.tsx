import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/shared/components/public-footer";
import { PublicHeader } from "@/shared/components/public-header";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
          {/* Large muted 404 */}
          <p className="font-heading text-8xl font-bold tracking-tight text-muted/30 select-none">
            404
          </p>
          <div className="space-y-2">
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              Page not found
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              That address is not part of SourceLab. Check the URL or go back
              to the home page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button nativeButton={false} render={<Link href="/" />}>
              Back to SourceLab
            </Button>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
