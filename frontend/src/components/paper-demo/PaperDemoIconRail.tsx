import { useState } from "react";
import { BookOpen, Compass, GitBranch, LineChart, MessageCircle, Users } from "lucide-react";

const ITEMS = [
  { id: "explore", label: "Explore", Icon: Compass },
  { id: "candidates", label: "Candidates", Icon: Users },
  { id: "graph", label: "Graph", Icon: GitBranch },
  { id: "history", label: "History", Icon: BookOpen },
  { id: "stats", label: "Stats", Icon: LineChart },
  { id: "about", label: "About", Icon: MessageCircle },
] as const;

export function PaperDemoIconRail() {
  const [active, setActive] = useState(0);

  return (
    <nav
      className="paper-demo-rail flex h-auto w-full shrink-0 flex-row items-center justify-center gap-1 border-b border-slate-800 bg-[#0f172a] py-2 lg:h-full lg:w-[72px] lg:min-h-0 lg:flex-col lg:justify-start lg:border-b-0 lg:border-r lg:py-3"
      aria-label="Paper demo tools"
    >
      {ITEMS.map((item, index) => {
        const Icon = item.Icon;
        const on = active === index;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={on}
            onClick={() => setActive(index)}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
              on ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
