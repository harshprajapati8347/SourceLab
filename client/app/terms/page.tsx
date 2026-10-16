import type { Metadata } from "next";
import { TermsOfService } from "@/features/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms for using SourceLab, including credits, cancellation, and AI limits.",
};

export default function TermsPage() {
  return <TermsOfService />;
}
