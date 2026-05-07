import { LayoutList, MessageSquare, Network } from "lucide-react";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function PaperDemoIconRail({
  screenshotMode,
  captureMode,
}: {
  screenshotMode?: boolean;
  captureMode?: boolean;
}) {
  const items = [
    {
      id: "candidates",
      label: "Candidates list",
      Icon: LayoutList,
      onClick: () => scrollToId("paper-demo-candidates-section"),
    },
    {
      id: "graph",
      label: "Graph & pipeline",
      Icon: Network,
      onClick: () => scrollToId("paper-demo-graph-section"),
    },
    {
      id: "validation",
      label: "Validation & explanation",
      Icon: MessageSquare,
      onClick: () => scrollToId("paper-demo-explanation-section"),
    },
  ] as const;

  return (
    <nav
      className="paper-demo-rail flex h-auto w-full shrink-0 flex-row items-center justify-center gap-1 border-b border-slate-800 bg-[#0f172a] py-2 lg:h-full lg:w-[72px] lg:min-h-0 lg:flex-col lg:justify-start lg:border-b-0 lg:border-r lg:py-3"
      aria-label="Paper demo navigation"
    >
      {items.map((item) => {
        const Icon = item.Icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={item.onClick}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
