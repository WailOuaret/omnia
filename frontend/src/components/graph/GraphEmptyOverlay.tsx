import { Network } from "lucide-react";

export function GraphEmptyOverlay({
  message = "No graph elements are visible with the current filters.",
}: {
  message?: string;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/60 backdrop-blur-[1px]">
      <div className="max-w-sm rounded-xl border border-border bg-surface p-5 text-center shadow-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-bg text-cyan">
          <Network className="h-5 w-5" />
        </div>
        <div className="mt-3 font-semibold text-ink">Graph hidden</div>
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
      </div>
    </div>
  );
}
