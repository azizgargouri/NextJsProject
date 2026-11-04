'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { UserAvatar } from '@/components/ui/user-avatar';
import { useUnreadNotifications } from '@/hooks/content/account';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { ADMIN_LOCALES, useAdminI18n } from '@/lib/i18n/admin';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';

export function AdminHeader({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const signOut = useSignOut();
  const { m } = useAdminI18n();
  const unread = useUnreadNotifications();
  const unreadCount = unread.data ?? 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-5">
      <div className="flex items-center gap-3">
        <AdminButton
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenNavigation}
          aria-label={m.shell.openNavigation}
        >
          <Menu />
        </AdminButton>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold">{m.shell.console}</p>
          <p className="text-xs text-muted-foreground">{m.shell.workspace}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <AdminButton
          asChild
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? m.shell.notificationsUnread(unreadLabel) : m.shell.notifications
          }
        >
          <Link href="/admin/notifications">
            <Bell />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                {unreadLabel}
              </span>
            ) : null}
          </Link>
        </AdminButton>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <AdminButton
              variant="ghost"
              className="h-10 gap-2 px-2"
              aria-label={m.shell.openUserMenu}
            >
              <UserAvatar name={user?.name ?? 'Admin'} avatarUrl={user?.avatarUrl} />
              <span className="hidden max-w-40 text-left leading-tight lg:block">
                <span className="block truncate text-xs font-semibold">
                  {user?.name ?? 'Admin'}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user?.email}
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
              <MenuItem href="/admin/profile" icon={UserRound}>
                {m.shell.profile}
              </MenuItem>
              <MenuItem href="/admin/settings" icon={Settings}>
                {m.shell.settings}
              </MenuItem>
              <MenuItem href="/admin/notifications" icon={Bell}>
                {m.shell.notifications}
                {unreadCount > 0 ? (
                  <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">
                    {unreadLabel}
                  </span>
                ) : null}
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
                {signOut.isPending ? m.shell.signingOut : m.shell.signOut}
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
  href,
  children,
}: {
  icon: typeof UserRound;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
      >
        <Icon className="size-4" />
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale, m } = useAdminI18n();
  return (
    <div
      role="radiogroup"
      aria-label={m.shell.language.group}
      className="flex h-8 items-center rounded-md bg-muted p-0.5"
    >
      {ADMIN_LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          lang={value}
          aria-checked={locale === value}
          aria-label={m.languages[value]}
          title={m.languages[value]}
          onClick={() => setLocale(value)}
          data-active={locale === value}
          className="flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold uppercase text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-xs"
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function ThemeSwitcher() {
  const { m } = useAdminI18n();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-24 rounded-md bg-muted" aria-hidden />;

  return (
    <div
      role="group"
      className="flex h-8 items-center rounded-md bg-muted p-0.5"
      aria-label={m.shell.theme.group}
    >
      {[
        { value: 'system', label: m.shell.theme.system, icon: Laptop },
        { value: 'light', label: m.shell.theme.light, icon: Sun },
        { value: 'dark', label: m.shell.theme.dark, icon: Moon },
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
