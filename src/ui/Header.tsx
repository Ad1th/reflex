import { fmtMs } from "./model";

export interface HeaderStats {
  librarySize?: number;
  live?: number;
  synthetic?: number;
  llmAvoided: number;
  timeSavedMs: number;
  mossP50?: number;
}

function Num({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`tnum font-mono text-[12.5px] ${accent ? "text-reflex" : "text-ink"}`}>{children}</span>;
}

export function Header({
  stats,
  onOpenMoss,
  mossOpen,
}: {
  stats: HeaderStats;
  onOpenMoss: () => void;
  mossOpen: boolean;
}) {
  const saved = stats.timeSavedMs;
  const savedText = saved < 1000 ? `${Math.round(saved)} ms` : `${(saved / 1000).toFixed(1)} s`;
  return (
    <header className="shrink-0">
      <div className="flex items-baseline gap-6">
        <h1 className="text-[30px] leading-none font-medium tracking-[-0.03em]">Reflex</h1>
        <button
          onClick={onOpenMoss}
          aria-expanded={mossOpen}
          className="ml-auto text-[13px] text-graphite underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink"
        >
          Why Moss?
        </button>
      </div>
      <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.45] text-graphite">
        Remembers each step an agent takes and replays it instead of calling the LLM again.
      </p>
      <p className="mt-3 text-[13px] leading-[1.6] text-muted">
        The library holds <Num>{stats.librarySize == null ? "–" : stats.librarySize.toLocaleString()}</Num> reflexes
        {stats.live != null && <>, {stats.live} learned live</>}. This session avoided{" "}
        <Num accent={stats.llmAvoided > 0}>{stats.llmAvoided}</Num> LLM calls and saved <Num>{savedText}</Num>. Median
        lookup <Num>{fmtMs(stats.mossP50)}</Num>.
      </p>
    </header>
  );
}
