/** Instant skeleton while a workspace page streams from the server (course ch.2 loading.tsx). */
export default function WorkspaceLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-3 w-24 bg-ink/20" />
      <div className="h-12 w-2/3 bg-ink/15 md:h-16" />
      <div className="grid gap-px border border-ink/20 bg-ink/10 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-32 bg-paper" />
        ))}
      </div>
    </div>
  );
}
