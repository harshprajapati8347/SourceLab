import type { Metadata } from "next";
import { PrivacyPolicy } from "@/features/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How SourceLab handles accounts, sources, chat, memory, and billing.",
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
