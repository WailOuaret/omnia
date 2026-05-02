import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { FileText, Monitor } from "lucide-react";

interface PaperModeToggleProps {
  className?: string;
}

/**
 * Switches between the full `/demo` workbench and the standalone `/paper-demo` COVID figure route.
 * Legacy `?paper=1` on `/` or `/demo` redirects to `/paper-demo` (see `DemoWorkbenchEntry` in App).
 */
export function PaperModeToggle({ className }: PaperModeToggleProps) {
  const { pathname } = useLocation();
  const onPaperDemo = pathname === "/paper-demo";

  const label = onPaperDemo ? "Standard demo chrome" : "Paper / screenshot layout";
  const target = onPaperDemo ? "/demo" : "/paper-demo";

  return (
    <Link
      to={target}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900",
        className,
      )}
      aria-label={`Switch to ${label}`}
      data-paper-mode={onPaperDemo ? "on" : "off"}
    >
      {onPaperDemo ? <Monitor className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      {label}
    </Link>
  );
}
