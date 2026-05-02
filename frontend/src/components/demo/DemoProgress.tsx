interface DemoProgressProps {
  currentIndex: number;
  total: number;
}

export function DemoProgress({ currentIndex, total }: DemoProgressProps) {
  const percentage = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        <span>Demo progress</span>
        <span>
          {currentIndex + 1}/{total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
