import { fmtSec, runLlmCalls, stepReflexCount, type RunRecord } from "./model";

function flowOf(r: RunRecord) {
  return r.flow ?? r.instruction;
}

/** Speedup of `r` over the first finished run of the same task family, if any. */
export function speedupFor(r: RunRecord, runs: RunRecord[]) {
  if (r.status !== "done" || r.wallMs == null) return undefined;
  const first = runs.find((x) => x.status === "done" && x.wallMs != null && flowOf(x) === flowOf(r));
  if (!first || first === r || first.wallMs == null) return undefined;
  const x = first.wallMs / r.wallMs;
  return x >= 1.5 ? { x, first } : undefined;
}

export function RunHistory({
  runs,
  now,
  selected,
  onSelect,
  onForget,
  forgetting,
  canForget,
}: {
  runs: RunRecord[];
  now: number;
  selected?: number;
  onSelect: (n: number) => void;
  onForget: () => void;
  forgetting: boolean;
  canForget: boolean;
}) {
  const wall = (r: RunRecord) => r.wallMs ?? Math.max(0, now - r.startedAt);
  const max = Math.max(1, ...runs.map(wall));
  const shown = runs.slice(-5);
  const latest = runs.at(-1);
  const best = latest ? speedupFor(latest, runs) : undefined;

  return (
    <section className="flex shrink-0 gap-4 rounded-lg border border-rule bg-panel p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex items-center text-[12px]">
          <span className="font-semibold text-ink">Learning curve</span>
          <span className="ml-3 flex items-center gap-3 text-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-llm" /> LLM steps
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-reflex" /> Reflex steps
            </span>
          </span>
          <button
            onClick={onForget}
            disabled={!canForget || forgetting}
            className="ml-auto text-muted underline decoration-rule underline-offset-4 hover:text-danger hover:decoration-danger disabled:opacity-40"
          >
            {forgetting ? "Forgetting…" : "Forget everything"}
          </button>
        </div>
        {shown.length === 0 && (
          <p className="py-6 text-[12px] text-faint">Wall time for each run will stack up here.</p>
        )}
        <ul className="flex flex-col gap-1.5">
          {shown.map((r) => {
            const total = Math.max(1, r.steps.length);
            const reflexShare = stepReflexCount(r.steps) / total;
            const w = (wall(r) / max) * 100;
            const calls = runLlmCalls(r);
            const isSel = selected === r.n;
            return (
              <li key={r.n}>
                <button
                  onClick={() => onSelect(r.n)}
                  className={`grid w-full grid-cols-[210px_1fr] items-center gap-3 rounded px-1.5 py-0.5 text-left ${
                    isSel ? "bg-panel-2" : "hover:bg-panel-2/60"
                  }`}
                >
                  <span className="tnum truncate text-[12px] text-muted">
                    <span className="font-semibold text-ink">Run {r.n}</span> · {fmtSec(wall(r))} ·{" "}
                    {calls} LLM call{calls === 1 ? "" : "s"}
                    {r.variant !== "normal" && <span className="text-fallback"> · chaos</span>}
                  </span>
                  <svg width="100%" height="12" aria-hidden className="overflow-visible">
                    <rect x="0" y="0" width="100%" height="12" rx="2" fill="var(--rule-soft)" />
                    <rect x="0" y="0" width={`${w}%`} height="12" rx="2" fill="var(--llm)" />
                    <rect
                      x={`${w * (1 - reflexShare)}%`}
                      y="0"
                      width={`${w * reflexShare}%`}
                      height="12"
                      rx="2"
                      fill="var(--reflex)"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex w-[150px] shrink-0 flex-col justify-center border-l border-rule pl-4">
        {best ? (
          <div key={latest!.n} className="rx-pop">
            <div className="tnum text-[52px] leading-[48px] font-bold tracking-[-0.05em] text-reflex">
              {best.x >= 10 ? Math.round(best.x) : best.x.toFixed(1)}×
            </div>
            <div className="text-[15px] font-semibold text-ink">faster</div>
            <div className="tnum mt-1.5 text-[12px] leading-4 text-muted">
              Run {latest!.n} vs run {best.first.n}, same kind of task: {fmtSec(best.first.wallMs!)} to{" "}
              {fmtSec(latest!.wallMs!)} of agent time
            </div>
          </div>
        ) : (
          <div className="text-[12px] leading-4 text-faint">
            Run the same kind of task twice to see the speedup.
          </div>
        )}
      </div>
    </section>
  );
}
