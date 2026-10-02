"use client";

import Link from "next/link";
import {
  BrainIcon,
  CheckIcon,
  CreditCardIcon,
  KeyboardIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { billingRoutes } from "@/features/billing/lib/routes";
import { memoryRoutes } from "@/features/memory/lib/routes";
import { useUIStore } from "@/shared/stores/ui-store";
import { useSession } from "../hooks/use-session";
import { useSignOut } from "../hooks/use-sign-out";

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Account menu: billing, memory, theme, shortcuts, sign out. */
export function UserMenu() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { signOut, isPending } = useSignOut();
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);

  const user = session?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Account menu"
          />
        }
      >
        <Avatar size="default">
          {user?.image ? (
            <AvatarImage src={user.image} alt="" />
          ) : null}
          <AvatarFallback className="bg-secondary text-xs font-semibold">
            {getInitials(user?.name, user?.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid gap-0.5 px-2 py-2">
            <span className="truncate text-sm font-medium text-foreground">
              {user?.name ?? "Your account"}
            </span>
            {user?.email ? (
              <span className="truncate text-xs">{user.email}</span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={billingRoutes.settings} />}>
          <CreditCardIcon />
          Billing and credits
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={memoryRoutes.settings} />}>
          <BrainIcon />
          Memory
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
          <KeyboardIcon />
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
              <Icon />
              {label}
              {theme === value ? (
                <CheckIcon className="ml-auto" aria-label="Current theme" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onClick={() => void signOut()}
        >
          {isPending ? <Spinner /> : <LogOutIcon />}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
