import { requireAuth } from "@/features/auth";
import { BillingSettings } from "@/features/billing";

export default async function BillingSettingsPage() {
  await requireAuth();

  return <BillingSettings />;
}
