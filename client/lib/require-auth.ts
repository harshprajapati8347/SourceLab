import { redirect } from "next/navigation";
import { getSession, type Session } from "@/lib/auth-server";
import { authRoutes } from "@/lib/auth-routes";

export async function requireAuth(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect(authRoutes.login);
  }

  return session;
}
