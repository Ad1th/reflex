import { fmtMs } from "./model";

export interface HeaderStats {
  librarySize?: number;
  live?: number;
  synthetic?: number;
  llmAvoided: number;
  timeSavedMs: number;
  mossP50?: number;
}

function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "reflex";
}) {
  return (
    <div className="flex min-w-[118px] flex-col justify-center border-l border-rule px-5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={`tnum text-[22px] leading-7 font-semibold tracking-tight ${
            tone === "reflex" ? "text-reflex" : "text-ink"
          }`}
        >
          {value}
        </span>
        {sub && <span className="tnum text-[11px] text-faint">{sub}</span>}
      </span>
    </div>
  );
}

function Mark() {
  // A reflex arc: stimulus in, straight back out, skipping the brain.
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="5" r="3" fill="none" stroke="var(--llm)" strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M3 21 C 9 21, 9 13, 13 13 S 17 21, 23 21" fill="none" stroke="var(--reflex)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23" cy="21" r="2" fill="var(--reflex)" />
    </svg>
  );
}

export function Header({ stats, onOpenMoss }: { stats: HeaderStats; onOpenMoss: () => void }) {
  const saved = stats.timeSavedMs;
  return (
    <header className="flex h-[72px] shrink-0 items-stretch border-b border-rule bg-night">
      <div className="flex items-center gap-3 pr-6 pl-6">
        <Mark />
        <div className="flex flex-col">
          <h1 className="text-[22px] leading-6 font-bold tracking-[-0.02em]">Reflex</h1>
          <p className="text-[13px] leading-5 text-muted">
            AI agents that get faster every time they do something twice.
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-stretch py-3">
        <Stat
          label="Reflex library"
          value={stats.librarySize == null ? "–" : stats.librarySize.toLocaleString()}
          sub={stats.live != null ? `${stats.live} learned live` : undefined}
        />
        <Stat label="LLM calls avoided" value={String(stats.llmAvoided)} tone="reflex" />
        <Stat
          label="Time saved"
          value={saved < 1000 ? `${Math.round(saved)}ms` : `${(saved / 1000).toFixed(1)}s`}
          tone="reflex"
        />
        <Stat label="Moss lookup p50" value={fmtMs(stats.mossP50)} />
        <div className="flex items-center border-l border-rule px-5">
          <button
            onClick={onOpenMoss}
            className="rounded-md border border-rule px-3 py-1.5 text-[13px] text-ink transition-colors hover:border-muted hover:bg-panel-2"
          >
            Why Moss?
          </button>
        </div>
      </div>
    </header>
  );
}
