import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminBadge } from '@/components/ui/admin-badge';
import type { AnalysisSource, Sentiment } from '@/types';

/** Small admin primitives shared by the disputes desk and review moderation. */

export const AdminTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
AdminTextarea.displayName = 'AdminTextarea';

export function AdminField({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SourceBadge({ source, model }: { source: AnalysisSource; model?: string | null }) {
  return (
    <AdminBadge
      variant={source === 'ai' ? 'default' : 'outline'}
      title={model ?? 'Deterministic keyword rules'}
    >
      <Sparkles className="size-3" />
      {source === 'ai' ? `AI${model ? ` · ${model}` : ''}` : 'Rules'}
    </AdminBadge>
  );
}

const SENTIMENT_VARIANT: Record<Sentiment, 'success' | 'secondary' | 'destructive'> = {
  POSITIVE: 'success',
  NEUTRAL: 'secondary',
  NEGATIVE: 'destructive',
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return <AdminBadge variant={SENTIMENT_VARIANT[sentiment]}>{sentiment.toLowerCase()}</AdminBadge>;
}

export function RatingDots({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <span
          key={index}
          className={cn('size-2 rounded-full', index <= value ? 'bg-primary' : 'bg-border')}
        />
      ))}
    </span>
  );
}

export const adminDate = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function apiErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string } } } | null)?.response;
  return response?.data?.message ?? fallback;
}
