'use client';

import Link from 'next/link';
import { ArrowUpRight, Truck, Home, AlertCircle, Star, Bot } from 'lucide-react';
import { DashboardView } from '@/components/features/hr/dashboard-view';
import { HomesDashboardEntry } from '@/components/features/homes/homes-dashboard-entry';
import { useAuthStore } from '@/hooks/stores/auth-store';

export function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  if (role === 'ADMIN') {
    return <DashboardView />;
  }

  const isMover = role === 'MOVER';

  const clientCells = [
    {
      href: '/request',
      title: 'REQUEST A MOVE',
      meta: '3D LiDAR & photo load estimator',
      tag: 'LIVE ESTIMATOR',
      icon: Truck,
    },
    {
      href: '/dashboard/homes',
      title: 'SMART ROOM LAYOUT',
      meta: 'Manage rooms & 2D layout planning',
      tag: 'ROOM PLANNER',
      icon: Home,
    },
    {
      href: '/dashboard/claims',
      title: 'MY CLAIMS',
      meta: 'Report damages, track dispute resolutions',
      tag: 'DISPUTE RESOLUTION',
      icon: AlertCircle,
    },
    {
      href: '/dashboard/reviews',
      title: 'RATE A MOVER',
      meta: 'Leave verified feedback & reviews',
      tag: 'COMMUNITY RATING',
      icon: Star,
    },
    {
      href: '/dashboard/assistant',
      title: 'AI ASSISTANT',
      meta: 'MoveUp AI moving & claims assistant',
      tag: '24/7 INTELLIGENCE',
      icon: Bot,
    },
  ];

  const moverCells = [
    {
      href: '/dashboard/claims',
      title: 'CLAIMS ABOUT ME',
      meta: 'Review customer claims & respond',
      tag: 'QUALITY AUDIT',
      icon: AlertCircle,
    },
    {
      href: '/dashboard/reviews',
      title: 'MY REVIEWS & RATING',
      meta: 'Verified customer ratings & replies',
      tag: 'PERFORMANCE',
      icon: Star,
    },
    {
      href: '/dashboard/assistant',
      title: 'AI ASSISTANT',
      meta: 'Regulatory & moving advice assistant',
      tag: 'AI SUPPORT',
      icon: Bot,
    },
  ];

  const cells = isMover ? moverCells : clientCells;

  return (
    <div>
      <p className="mono text-[10px] text-hazard">{role || 'CLIENT'} WORKSPACE</p>
      <h1 className="display mt-2 text-4xl md:text-6xl">
        HELLO{user?.name ? `, ${user.name.split(' ')[0]?.toUpperCase() ?? ''}` : ''}.
      </h1>
      <p className="mono mt-4 text-[11px] text-ink-80">
        MANAGE MOVES, QUOTES, SMART ROOM LAYOUTS, CLAIMS &amp; RATINGS.
      </p>

      <div className="mono mt-10 grid grid-cols-1 gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <Link
              key={cell.href}
              href={cell.href}
              className="group flex flex-col justify-between bg-paper p-6 transition-colors hover:bg-ink hover:text-paper"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="mono text-[10px] text-hazard">{cell.tag}</span>
                  <ArrowUpRight className="size-4 text-hazard transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Icon className="size-5 text-ink-60 group-hover:text-paper" />
                  <p className="display text-xl">{cell.title}</p>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-ink-60 group-hover:text-paper/70">{cell.meta}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10">
        <HomesDashboardEntry />
      </div>
    </div>
  );
}
