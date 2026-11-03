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
  href?: string;
  icon: LucideIcon;
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
      { label: 'Move requests', icon: ClipboardList, upcoming: true },
      { label: 'Assignments', icon: Truck, upcoming: true },
      { label: 'Disputes', icon: Gavel, upcoming: true },
    ],
  },
  {
    label: 'Network',
    items: [
      { label: 'User accounts', href: '/admin/users', icon: Users },
      { label: 'Mover reviews', icon: ShieldCheck, upcoming: true },
      { label: 'Customer reviews', icon: MessageSquareText, upcoming: true },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Pricing rules', icon: BadgeDollarSign, upcoming: true },
      { label: 'Content', icon: FileText, upcoming: true },
      { label: 'Audit log', icon: History, upcoming: true },
    ],
  },
];
