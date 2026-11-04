import {
  BadgeDollarSign,
  ClipboardList,
  FileText,
  Gauge,
  Gavel,
  History,
  MessageSquareText,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** True while the module's product domain is not connected to the back office. */
  upcoming?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: 'Workspace',
    items: [{ label: 'Overview', href: '/admin', icon: Gauge }],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Move requests', href: '/admin/moves', icon: ClipboardList, upcoming: true },
      { label: 'Assignments', href: '/admin/assignments', icon: Truck, upcoming: true },
      { label: 'Disputes', href: '/admin/disputes', icon: Gavel, upcoming: true },
    ],
  },
  {
    label: 'Network',
    items: [
      { label: 'User accounts', href: '/admin/users', icon: Users },
      { label: 'Mover reviews', href: '/admin/mover-reviews', icon: ShieldCheck, upcoming: true },
      {
        label: 'Customer reviews',
        href: '/admin/customer-reviews',
        icon: MessageSquareText,
        upcoming: true,
      },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Pricing rules', href: '/admin/pricing', icon: BadgeDollarSign },
      { label: 'Content', href: '/admin/content', icon: FileText },
      { label: 'Audit log', href: '/admin/audit', icon: History },
    ],
  },
];
