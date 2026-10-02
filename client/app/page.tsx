import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authRoutes, getSession } from "@/features/auth";
import { LandingPage } from "@/features/landing";

export const metadata: Metadata = {
  title: "SourceLab",
  description:
    "A notebook for your sources. Ask questions, open the citation, and turn the same material into study tools.",
};

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(authRoutes.dashboard);
  }

  return <LandingPage />;
}
