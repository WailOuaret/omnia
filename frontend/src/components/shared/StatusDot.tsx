import clsx from "clsx";

interface StatusDotProps {
  status: "ok" | "error" | "loading" | "unknown";
  label: string;
}

export function StatusDot({ status, label }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
      <span
        className={clsx(
          "h-2.5 w-2.5 rounded-full",
          status === "ok" && "bg-green",
          status === "error" && "bg-red",
          status === "loading" && "animate-pulse bg-amber",
          status === "unknown" && "bg-muted",
        )}
      />
      {label}
    </span>
  );
}
