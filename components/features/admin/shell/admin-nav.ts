import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  Gavel,
  HardDrive,
  History,
  MessageSquareText,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdminMessages } from '@/lib/i18n/admin';

export type AdminNavKey = keyof AdminMessages['nav']['items'];
export type AdminNavGroupKey = keyof AdminMessages['nav']['groups'];

export interface AdminNavItem {
  /** Dictionary key under `nav.items` — labels are resolved per locale. */
  key: AdminNavKey;
  href: string;
  icon: LucideIcon;
  /** True while the module's product domain is not connected to the back office. */
  upcoming?: boolean;
}

export interface AdminNavGroup {
  key: AdminNavGroupKey;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    key: 'workspace',
    items: [
      { key: 'overview', href: '/admin', icon: Gauge },
      // HR lives in the staff workspace (employees, attendance, leave, contracts).
      { key: 'hr', href: '/dashboard', icon: BriefcaseBusiness },
    ],
  },
  {
    key: 'operations',
    items: [
      { key: 'moves', href: '/admin/moves', icon: ClipboardList, upcoming: true },
      { key: 'assignments', href: '/admin/assignments', icon: Truck, upcoming: true },
      { key: 'disputes', href: '/admin/disputes', icon: Gavel, upcoming: true },
    ],
  },
  {
    key: 'network',
    items: [
      { key: 'users', href: '/admin/users', icon: Users },
      { key: 'moverReviews', href: '/admin/mover-reviews', icon: ShieldCheck, upcoming: true },
      {
        key: 'customerReviews',
        href: '/admin/customer-reviews',
        icon: MessageSquareText,
        upcoming: true,
      },
    ],
  },
  {
    key: 'control',
    items: [
      { key: 'pricing', href: '/admin/pricing', icon: BadgeDollarSign },
      { key: 'content', href: '/admin/content', icon: FileText },
      { key: 'storage', href: '/admin/storage', icon: HardDrive },
      { key: 'audit', href: '/admin/audit', icon: History },
      { key: 'playground', href: '/admin/playground', icon: FlaskConical },
    ],
  },
];
