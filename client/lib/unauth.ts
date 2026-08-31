import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { authRoutes } from "@/lib/auth-routes";

export async function unauth() {
  const session = await getSession();

  if (session) {
    redirect(authRoutes.dashboard);
  }
}
