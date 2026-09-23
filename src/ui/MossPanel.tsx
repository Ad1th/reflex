"use client";

import { useState } from "react";
import { fmtMs } from "./model";

interface Bench {
  librarySize: number;
  moss: { p50: number; p99: number };
  brute: { p50: number; p99: number };
}

const GRID = "grid grid-cols-[150px_minmax(0,1fr)_64px_56px] items-baseline gap-x-4";

function Line({
  name,
  note,
  stats,
  max,
  color,
}: {
  name: string;
  note: string;
  stats: { p50: number; p99: number };
  max: number;
  color: string;
}) {
  const p50 = Math.max(0.6, (stats.p50 / max) * 100);
  const p99 = Math.min(100, (stats.p99 / max) * 100);
  return (
    <div className={`${GRID} py-3`}>
      <span className="min-w-0">
        <span className="block text-[15px] text-ink">{name}</span>
        <span className="block text-[12.5px] leading-4 text-muted">{note}</span>
      </span>
      <svg width="100%" height="10" aria-hidden className="self-center overflow-visible">
        <rect x="0" y="3" width={`${p50}%`} height="4" fill={color} />
        <line x1={`${p50}%`} x2={`${p99}%`} y1="5" y2="5" stroke={color} strokeWidth="1" />
        <line x1={`${p99}%`} x2={`${p99}%`} y1="1" y2="9" stroke={color} strokeWidth="1" />
      </svg>
      <span className="tnum text-right font-mono text-[13px] text-ink">{fmtMs(stats.p50)}</span>
      <span className="tnum text-right font-mono text-[12px] text-muted">{fmtMs(stats.p99)}</span>
    </div>
  );
}

export function MossPanel({ open, onClose, librarySize }: { open: boolean; onClose: () => void; librarySize?: number }) {
  const [bench, setBench] = useState<Bench>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function run() {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch("/api/reflex/bench?n=200", { cache: "no-store" });
      if (!res.ok) throw new Error(`benchmark returned ${res.status}`);
      setBench((await res.json()) as Bench);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const max = bench ? Math.max(bench.moss.p99, bench.brute.p99, 0.001) : 1;
  const ratio = bench && bench.moss.p50 > 0 ? bench.brute.p50 / bench.moss.p50 : undefined;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-paper px-10 pt-9" role="dialog" aria-label="Why Moss">
      <div className="flex items-baseline gap-6">
        <h2 className="text-[30px] leading-none font-medium tracking-[-0.03em]">Why Moss</h2>
        <button
          onClick={onClose}
          className="ml-auto text-[13px] text-graphite underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink"
          aria-label="Close"
        >
          Close
        </button>
      </div>
      <p className="mt-5 max-w-[50ch] text-[15px] leading-[1.6] text-graphite">
        Before every step the agent asks: have I been in this exact situation before? That question runs on every
        click, so it has to cost less than a millisecond. Moss answers it from an in-process vector index. The LLM is
        only called when there is no confident answer.
      </p>
      <div className="mt-8 flex items-center gap-5">
        <button
          onClick={run}
          disabled={busy}
          className="h-10 bg-ink px-6 text-[14px] font-medium text-paper hover:bg-graphite disabled:opacity-50"
        >
          {busy ? "Measuring…" : bench ? "Measure again" : "Measure lookups"}
        </button>
        <span className="text-[13px] text-muted">
          200 lookups against{" "}
          <span className="tnum font-mono text-[12.5px] text-ink">
            {(bench?.librarySize ?? librarySize ?? 0).toLocaleString()}
          </span>{" "}
          stored reflexes
        </span>
      </div>
      {err && <p className="mt-5 text-[13px] text-danger">Benchmark failed: {err}. Check that the server is running.</p>}
      {bench && bench.librarySize === 0 && (
        <p className="mt-5 text-[14px] text-graphite">The reflex library is empty. Run a task first, then measure.</p>
      )}
      {bench && bench.librarySize > 0 && (
        <div className="mt-9 border-t border-rule pt-4">
          <div className={`${GRID} text-[12.5px] text-muted`}>
            <span>Method</span>
            <span>Latency, median to p99</span>
            <span className="text-right">Median</span>
            <span className="text-right">p99</span>
          </div>
          <Line name="Moss" note="in-process vector index" stats={bench.moss} max={max} color="var(--reflex)" />
          <Line name="Brute force" note="exact scan of every vector" stats={bench.brute} max={max} color="var(--llm)" />
          <p className="mt-6 max-w-[50ch] text-[19px] leading-[1.4] tracking-[-0.005em] text-ink">
            {ratio != null && ratio >= 1.2 ? (
              <>
                Moss is <span className="tnum text-reflex">{ratio.toFixed(1)}× faster</span> at the median at this
                library size.
              </>
            ) : (
              "At this library size a linear scan is still competitive; the gap grows with the library."
            )}
          </p>
          <p className="mt-3 max-w-[56ch] text-[13px] leading-[1.55] text-muted">
            Measured just now on this server. The same 200 stored vectors are the queries for both, so embedding time
            is excluded.
          </p>
        </div>
      )}
    </div>
  );
}
