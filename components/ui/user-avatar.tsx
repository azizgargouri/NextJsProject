import Image from 'next/image';
import { cn } from '@/lib/utils';

const SIZES = { sm: 32, md: 40, lg: 96 } as const;

export function initialsOf(name: string | null | undefined): string {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** Avatar from object storage when set, initials otherwise. */
export function UserAvatar({
  name,
  avatarUrl,
  size = 'sm',
  className,
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const pixels = SIZES[size];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-primary-foreground',
        size === 'lg' ? 'text-2xl' : 'text-xs',
        className,
      )}
      style={{ width: pixels, height: pixels }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={pixels}
          height={pixels}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  );
}
