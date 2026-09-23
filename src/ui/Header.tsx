import { fmtMs } from "./model";

export interface HeaderStats {
  librarySize?: number;
  live?: number;
  synthetic?: number;
  llmAvoided: number;
  timeSavedMs: number;
  mossP50?: number;
}

function Figure({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 whitespace-nowrap">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`tnum font-mono text-[13px] font-medium ${accent ? "text-reflex" : "text-ink"}`}>
        {value}
        {note && <span className="ml-1.5 font-normal text-faint">{note}</span>}
      </dd>
    </div>
  );
}

export function Header({ stats, onOpenMoss }: { stats: HeaderStats; onOpenMoss: () => void }) {
  const saved = stats.timeSavedMs;
  return (
    <header className="flex h-14 shrink-0 items-center gap-8 border-b border-ink px-6">
      <div className="flex items-baseline gap-4 whitespace-nowrap">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em]">Reflex</h1>
        <p className="text-[13px] text-graphite">
          Remembers each step an agent takes and replays it instead of calling the LLM again.
        </p>
      </div>
      <dl className="ml-auto flex items-baseline gap-6">
        <Figure
          label="Library"
          value={stats.librarySize == null ? "–" : stats.librarySize.toLocaleString()}
          note={stats.live != null ? `${stats.live} live` : undefined}
        />
        <Figure label="LLM calls avoided" value={String(stats.llmAvoided)} accent={stats.llmAvoided > 0} />
        <Figure
          label="Time saved"
          value={saved < 1000 ? `${Math.round(saved)} ms` : `${(saved / 1000).toFixed(1)} s`}
        />
        <Figure label="Lookup p50" value={fmtMs(stats.mossP50)} />
      </dl>
      <button
        onClick={onOpenMoss}
        className="h-7 shrink-0 rounded-[2px] border border-graphite px-2.5 text-[12.5px] text-ink hover:bg-ink hover:text-paper"
      >
        Why Moss?
      </button>
    </header>
  );
}
