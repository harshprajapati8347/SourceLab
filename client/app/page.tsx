import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authRoutes, getSession } from "@/features/auth";
import { LandingPage } from "@/features/landing";

export const metadata: Metadata = {
  title: "SourceLab | AI-Powered Research Workspace",
  description:
    "An AI-powered research workspace built with advanced RAG, query transformation, corrective retrieval, cited streaming answers, persistent memory, and AI-generated learning tools.",
};

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(authRoutes.dashboard);
  }

  return <LandingPage />;
}
