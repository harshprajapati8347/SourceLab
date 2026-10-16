import type { Metadata } from "next";
import { AcceptableUsePolicy } from "@/features/legal";

export const metadata: Metadata = {
  title: "Acceptable use",
  description: "What you may submit to SourceLab and how not to use it.",
};

export default function AcceptableUsePage() {
  return <AcceptableUsePolicy />;
}
