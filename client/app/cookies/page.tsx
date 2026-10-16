import type { Metadata } from "next";
import { CookiePolicy } from "@/features/legal";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Necessary storage and optional Google Tag Manager analytics on SourceLab.",
};

export default function CookiesPage() {
  return <CookiePolicy />;
}
