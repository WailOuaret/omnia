export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded-lg bg-surface" />
        <div className="h-8 w-96 animate-pulse rounded-lg bg-surface" />
        <div className="h-4 w-[32rem] animate-pulse rounded-lg bg-surface" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="panel border-t-[3px] border-t-border p-5"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-3 w-20 animate-pulse rounded bg-surface" />
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-surface" />
          </div>
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className="panel h-32 animate-pulse p-5"
          style={{ animationDelay: `${(i + 4) * 100}ms` }}
        />
      ))}
    </div>
  );
}
