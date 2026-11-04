'use client';

import Link from 'next/link';
import { ArrowRight, Bot, Gavel, MessageSquareText } from 'lucide-react';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import { useAdminQuality } from '@/hooks/content/admin';

const number = new Intl.NumberFormat('en-GB');

/** Overview block for the quality domain: claims, reviews and AI usage (real data only). */
export function QualityOverview() {
  const quality = useAdminQuality();
  if (quality.isPending) return <AdminSkeleton className="h-48" />;
  if (!quality.data) return null;
  const { claims, reviews, ai } = quality.data;

  const blocks = [
    {
      icon: Gavel,
      title: 'Disputes',
      href: '/admin/disputes',
      rows: [
        ['Open', claims.byStatus.OPEN],
        ['Under review', claims.byStatus.UNDER_REVIEW],
        ['High / urgent', claims.urgentOpen],
        [
          'Avg. resolution',
          claims.avgResolutionHours !== null ? `${claims.avgResolutionHours} h` : '—',
        ],
      ],
    },
    {
      icon: MessageSquareText,
      title: 'Customer reviews',
      href: '/admin/customer-reviews',
      rows: [
        ['Average rating', reviews.averageRating ?? '—'],
        ['Published', reviews.published],
        ['Flagged', reviews.byStatus.FLAGGED],
        ['Negative', reviews.negative],
      ],
    },
    {
      icon: Bot,
      title: 'AI assistant',
      href: null,
      rows: [
        ['Status', ai.enabled ? `${ai.provider} · ${ai.model}` : 'Rules fallback (no key)'],
        ['Questions · 30 d', number.format(ai.questionsLast30Days)],
        ['Tokens · 30 d', number.format(ai.tokensLast30Days)],
        ['Users · 30 d', ai.activeUsers],
      ],
    },
  ] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {blocks.map((block) => (
        <AdminCard key={block.title} className="flex flex-col p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <block.icon className="size-4 text-primary" /> {block.title}
          </div>
          <dl className="mt-4 flex-1 space-y-2">
            {block.rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {block.href ? (
            <AdminButton asChild variant="outline" size="sm" className="mt-5 w-fit">
              <Link href={block.href}>
                Open <ArrowRight />
              </Link>
            </AdminButton>
          ) : null}
        </AdminCard>
      ))}
    </div>
  );
}
