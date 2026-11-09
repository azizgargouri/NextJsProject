import type { AdminMessages } from '@/lib/i18n/admin';
import type { AccountNotificationDto } from '@/types';

/** Localized line for one notification, plus the page where it can be acted on. */
export function describeNotification(
  m: AdminMessages,
  item: AccountNotificationDto,
): { title: string; href: string | null } {
  const who = item.actor?.name ?? m.notifications.someone;
  const t = m.notifications.items;
  const info = item.logInfo;
  switch (item.event) {
    case 'SIGNUP':
      return { title: t.SIGNUP(who), href: '/admin/users' };
    case 'USER_CREATE':
      return { title: t.USER_CREATE(who), href: '/admin/users' };
    case 'USER_UPDATE':
      return { title: t.USER_UPDATE(who), href: '/admin/profile' };
    case 'USER_DELETE':
      return { title: t.USER_DELETE(who), href: '/admin/users' };
    case 'USER_STATUS':
      return { title: t.USER_STATUS(who, info.status), href: '/admin/users' };
    case 'PRICING_CREATE':
      return { title: t.PRICING_CREATE(who), href: '/admin/pricing' };
    case 'PRICING_UPDATE':
      return { title: t.PRICING_UPDATE(who), href: '/admin/pricing' };
    case 'PRICING_DELETE':
      return { title: t.PRICING_DELETE(who), href: '/admin/pricing' };
    case 'CONTENT_UPDATE':
      return { title: t.CONTENT_UPDATE(who), href: '/admin/content' };
    case 'STORAGE_DELETE':
      return { title: t.STORAGE_DELETE(who), href: '/admin/storage' };
    case 'PASSWORD_CHANGE':
      return { title: t.PASSWORD_CHANGE(), href: '/admin/settings' };
    case 'SESSION_REVOKE':
      return {
        title: info.scope === 'others' ? t.SESSION_REVOKE_OTHERS() : t.SESSION_REVOKE_ONE(),
        href: '/admin/settings',
      };
    default:
      return { title: t.fallback(who, m.audit.events[item.event] ?? item.event), href: null };
  }
}
