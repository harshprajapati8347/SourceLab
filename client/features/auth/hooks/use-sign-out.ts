"use client";

import { useState } from "react";
import { useAppRouter } from "@/shared/hooks/use-app-router";
import { signOut } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";

/** Signs the user out, then sends them to the login page. */
export function useSignOut() {
  const router = useAppRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);

    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push(authRoutes.login);
          router.refresh();
        },
      },
    });

    setIsPending(false);
  }

  return { signOut: handleSignOut, isPending };
}
