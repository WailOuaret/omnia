import type { ReactNode } from "react";

interface DemoNarrationCardProps {
  eyebrow: string;
  title: string;
  description: string;
  route: string;
  active?: boolean;
  children?: ReactNode;
}

export function DemoNarrationCard({
  eyebrow,
  title,
  description,
  route,
  active = false,
  children,
}: DemoNarrationCardProps) {
  return (
    <div className={`rounded-card border p-5 ${active ? "border-accent bg-accent/10" : "border-border bg-surface"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan">{eyebrow}</div>
        <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-muted">{route}</div>
      </div>
      <div className="mt-2 text-xl font-semibold text-ink">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
