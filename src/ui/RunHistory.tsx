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

const GRID = "grid grid-cols-[22px_140px_minmax(0,1fr)_52px_56px] items-baseline gap-x-3";

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
  const shown = runs.slice(-5);
  // Describe the most recent run that beat its first run (a slower chaos run shouldn't hide the result).
  const latest = [...runs].reverse().find((r) => speedupFor(r, runs));
  const best = latest ? speedupFor(latest, runs) : undefined;

  return (
    <section className="flex shrink-0 flex-col border-t border-rule pt-5 pb-7">
      <div className="flex items-baseline gap-4 pb-2">
        <h2 className="text-[15px] font-medium text-ink">Runs</h2>
        <span className="text-[13px] text-muted">
          Agent time, split into <span className="text-ink">LLM</span> and <span className="text-reflex">reflex</span>{" "}
          steps
        </span>
        <button
          onClick={onForget}
          disabled={!canForget || forgetting}
          className="ml-auto text-[13px] text-muted underline decoration-rule underline-offset-4 hover:text-danger hover:decoration-danger disabled:opacity-40"
        >
          {forgetting ? "Forgetting…" : "Forget everything"}
        </button>
      </div>

      {shown.length === 0 && (
        <p className="py-1 text-[14px] text-muted">Each run adds a line here, so you can compare them.</p>
      )}
      <ul>
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
                aria-pressed={isSel}
                className={`${GRID} group w-full py-[3px] text-left text-[13px] leading-[20px]`}
              >
                <span className={`tnum text-right font-mono text-[11.5px] ${isSel ? "text-ink" : "text-faint"}`}>{r.n}</span>
                <span className={`truncate ${isSel ? "text-ink" : "text-muted"} group-hover:text-ink`}>
                  {r.slots?.name ?? "…"}
                  {r.variant !== "normal" && (
                    <span className="ml-1.5 text-faint italic">{r.variant === "shuffled" ? "shuffled" : "renamed"}</span>
                  )}
                </span>
                <svg width="100%" height="4" aria-hidden className="self-center overflow-visible">
                  <rect x="0" y="0" width={`${w * (1 - reflexShare)}%`} height="4" fill="var(--llm)" opacity={isSel ? 1 : 0.85} />
                  <rect x={`${w * (1 - reflexShare)}%`} y="0" width={`${w * reflexShare}%`} height="4" fill="var(--reflex)" />
                </svg>
                <span className={`tnum text-right font-mono text-[12px] ${isSel ? "text-ink underline decoration-[1.5px] underline-offset-4" : "text-ink"}`}>
                  {fmtSec(wall(r))}
                </span>
                <span className="tnum text-right text-[12.5px] text-muted">
                  <span className="font-mono text-[12px]">{calls}</span> {calls === 1 ? "call" : "calls"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 min-h-[22px] text-[14px] leading-[22px] text-graphite">
        {best ? (
          <>
            Run {latest!.n} took <span className="tnum font-mono text-[13px] text-ink">{fmtSec(latest!.wallMs!)}</span>{" "}
            against <span className="tnum font-mono text-[13px] text-ink">{fmtSec(best.first.wallMs!)}</span> for run{" "}
            {best.first.n} on the same kind of task, so it was{" "}
            <span className="tnum text-reflex">{best.x >= 10 ? Math.round(best.x) : best.x.toFixed(1)}× faster</span>.
          </>
        ) : runs.length > 0 ? (
          <span className="text-muted">Run the same kind of task twice to see the speedup.</span>
        ) : null}
      </p>
    </section>
  );
}
