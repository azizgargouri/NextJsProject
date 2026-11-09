/** Inline loading state used while HR data is being fetched. */
export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <p className="mono border border-ink/30 px-4 py-6 text-center text-[10px] text-ink-40">
      {label.toUpperCase()}…
    </p>
  );
}
