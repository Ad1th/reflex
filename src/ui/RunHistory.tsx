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

/** Axis ticks in ms: a 1/2/5 step giving at most 5 ticks up to and including `maxMs`. */
function ticksFor(maxMs: number) {
  const raw = maxMs / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(maxMs / step) * step;
  const out: number[] = [];
  for (let t = 0; t <= top + step / 2; t += step) out.push(t);
  return { ticks: out, top };
}

function tickText(ms: number) {
  if (ms === 0) return "0";
  return ms < 1000 ? `${ms}ms` : `${+(ms / 1000).toFixed(1)}s`;
}

const GRID = "grid grid-cols-[46px_58px_40px_1fr] items-center gap-3";

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
  const max = Math.max(1000, ...runs.map(wall));
  const { ticks, top } = ticksFor(max);
  const shown = runs.slice(-5);
  const latest = runs.at(-1);
  const best = latest ? speedupFor(latest, runs) : undefined;

  return (
    <section className="flex shrink-0 flex-col border-t border-ink pt-2.5 pb-1">
      <div className="mb-1.5 flex items-baseline gap-4">
        <h2 className="text-[13px] font-semibold text-ink">Agent time per run</h2>
        <span className="flex items-center gap-3 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-[7px] bg-llm" /> LLM steps
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-[7px] bg-reflex" /> Reflex steps
          </span>
        </span>
        <button
          onClick={onForget}
          disabled={!canForget || forgetting}
          className="ml-auto text-[12px] text-muted underline decoration-rule underline-offset-[3px] hover:text-danger hover:decoration-danger disabled:opacity-40"
        >
          {forgetting ? "Forgetting…" : "Forget everything"}
        </button>
      </div>

      <div className={`${GRID} border-b border-rule px-1 py-1`}>
        <span className="rx-label">Run</span>
        <span className="rx-label text-right">Time</span>
        <span className="rx-label text-right">LLM</span>
        <span className="rx-label">Steps by source</span>
      </div>

      {shown.length === 0 && (
        <p className="px-1 py-3 text-[12.5px] text-muted">Each run adds a row here, so you can compare them.</p>
      )}
      <ul>
        {shown.map((r) => {
          const total = Math.max(1, r.steps.length);
          const reflexShare = stepReflexCount(r.steps) / total;
          const w = (wall(r) / top) * 100;
          const calls = runLlmCalls(r);
          const isSel = selected === r.n;
          return (
            <li key={r.n}>
              <button
                onClick={() => onSelect(r.n)}
                aria-pressed={isSel}
                className={`${GRID} tnum w-full border-b border-rule-soft px-1 py-[3px] text-left font-mono text-[12px] ${
                  isSel ? "bg-wash" : "hover:bg-wash/60"
                }`}
              >
                <span className={isSel ? "font-medium text-ink" : "text-graphite"}>
                  {r.n}
                  {r.variant !== "normal" && (
                    <span className="ml-1 text-[10.5px] text-fallback" title="Chaos variant">
                      {r.variant === "shuffled" ? "S" : "R"}
                    </span>
                  )}
                </span>
                <span className="text-right text-ink">{fmtSec(wall(r))}</span>
                <span className="text-right text-graphite">{calls}</span>
                <svg width="100%" height="8" aria-hidden className="overflow-visible">
                  <rect x="0" y="0" width={`${w * (1 - reflexShare)}%`} height="8" fill="var(--llm)" />
                  <rect x={`${w * (1 - reflexShare)}%`} y="0" width={`${w * reflexShare}%`} height="8" fill="var(--reflex)" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      {shown.length > 0 && (
        <div className={`${GRID} px-1`}>
          <span />
          <span />
          <span />
          <div className="relative h-5">
            {ticks.map((t) => {
              const x = (t / top) * 100;
              return (
                <span key={t} className="absolute top-0 flex flex-col items-center" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
                  <span className="h-1 w-px bg-graphite" />
                  <span className="tnum font-mono text-[10px] leading-4 text-muted">{tickText(t)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-1 min-h-[20px] px-1 text-[13px] leading-5 text-graphite">
        {best ? (
          <>
            Run {latest!.n} took <span className="tnum font-mono text-ink">{fmtSec(latest!.wallMs!)}</span> against{" "}
            <span className="tnum font-mono text-ink">{fmtSec(best.first.wallMs!)}</span> for run {best.first.n} on the
            same kind of task:{" "}
            <span className="tnum font-mono font-medium text-reflex">
              {best.x >= 10 ? Math.round(best.x) : best.x.toFixed(1)}× faster
            </span>
            .
          </>
        ) : runs.length > 0 ? (
          <span className="text-muted">Run the same kind of task twice to see the speedup.</span>
        ) : null}
      </p>
    </section>
  );
}
