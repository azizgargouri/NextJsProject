'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bell,
  ChevronDown,
  Laptop,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import { AdminButton } from '@/components/ui/admin-button';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';

export function AdminHeader({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const signOut = useSignOut();
  const initials = user?.name
    ?.split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-5">
      <div className="flex items-center gap-3">
        <AdminButton
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
        >
          <Menu />
        </AdminButton>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold">Operations console</p>
          <p className="text-xs text-muted-foreground">Tunisia · Live workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <AdminButton variant="ghost" size="icon" aria-label="Notifications" disabled>
          <Bell />
        </AdminButton>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <AdminButton variant="ghost" className="h-10 gap-2 px-2" aria-label="Open user menu">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials || 'AD'}
              </span>
              <span className="hidden max-w-40 text-left leading-tight lg:block">
                <span className="block truncate text-xs font-semibold">
                  {user?.name ?? 'Admin'}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user?.email ?? 'admin@moveup.tn'}
                </span>
              </span>
              <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" />
            </AdminButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-[120] min-w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <div className="px-2 py-2">
                <p className="text-sm font-semibold">{user?.name ?? 'MoveUp Admin'}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <MenuItem disabled icon={UserRound}>
                Profile
              </MenuItem>
              <MenuItem disabled icon={Settings}>
                Account settings
              </MenuItem>
              <MenuItem disabled icon={Bell}>
                Notifications
              </MenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                disabled={signOut.isPending}
                onSelect={() =>
                  signOut.mutate(undefined, { onSuccess: () => router.replace('/sign-in') })
                }
                className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
              >
                <LogOut className="size-4" />
                {signOut.isPending ? 'Signing out…' : 'Sign out'}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  disabled,
  children,
}: {
  icon: typeof UserRound;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
    >
      <Icon className="size-4" />
      {children}
      {disabled ? <span className="ml-auto text-[10px] text-muted-foreground">Soon</span> : null}
    </DropdownMenu.Item>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-24 rounded-md bg-muted" aria-hidden />;

  return (
    <div
      role="group"
      className="flex h-8 items-center rounded-md bg-muted p-0.5"
      aria-label="Color theme"
    >
      {[
        { value: 'system', label: 'System theme', icon: Laptop },
        { value: 'light', label: 'Light theme', icon: Sun },
        { value: 'dark', label: 'Dark theme', icon: Moon },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-xs"
          data-active={theme === value}
          aria-label={label}
          aria-pressed={theme === value}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
