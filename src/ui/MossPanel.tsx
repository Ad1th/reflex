"use client";

import { useState } from "react";
import { fmtMs } from "./model";

interface Bench {
  librarySize: number;
  moss: { p50: number; p99: number };
  brute: { p50: number; p99: number };
}

const GRID = "grid grid-cols-[1fr_64px_64px_110px] items-center gap-3";

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
  const p50 = Math.max(0.8, (stats.p50 / max) * 100);
  const p99 = Math.min(100, (stats.p99 / max) * 100);
  return (
    <div className={`${GRID} border-b border-rule-soft py-2`}>
      <span className="min-w-0">
        <span className="block text-[12.5px] text-ink">{name}</span>
        <span className="block text-[11.5px] leading-4 text-muted">{note}</span>
      </span>
      <span className="tnum text-right font-mono text-[12px] font-medium text-ink">{fmtMs(stats.p50)}</span>
      <span className="tnum text-right font-mono text-[12px] text-graphite">{fmtMs(stats.p99)}</span>
      <svg width="100%" height="10" aria-hidden className="overflow-visible">
        <line x1="0" x2="100%" y1="5" y2="5" stroke="var(--rule)" />
        <rect x="0" y="1" width={`${p50}%`} height="8" fill={color} />
        <line x1={`${p99}%`} x2={`${p99}%`} y1="-1" y2="11" stroke={color} strokeWidth="1.5" />
      </svg>
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
    <div className="absolute top-0 right-6 z-20" role="dialog" aria-label="Why Moss">
      <div className="w-[500px] rounded-b-[3px] border border-t-0 border-ink bg-sheet px-5 pt-4 pb-4 shadow-[0_12px_32px_-16px_rgba(23,25,28,0.35)]">
        <div className="flex items-baseline">
          <h2 className="text-[15px] font-semibold">Why Moss</h2>
          <button onClick={onClose} className="ml-auto text-[12.5px] text-muted underline decoration-rule underline-offset-[3px] hover:text-ink" aria-label="Close">
            Close
          </button>
        </div>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.55] text-graphite">
          Before every step the agent asks: have I been in this exact situation before? That question runs on every
          click, so it has to cost less than a millisecond. Moss answers it from an in-process vector index; the LLM
          is only called when there is no confident answer.
        </p>
        <div className="mt-3.5 flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="h-7 rounded-[2px] bg-ink px-3 text-[12.5px] font-medium text-paper hover:bg-graphite disabled:opacity-50"
          >
            {busy ? "Measuring…" : bench ? "Measure again" : "Measure lookups"}
          </button>
          <span className="tnum font-mono text-[11.5px] text-muted">
            n=200 against {(bench?.librarySize ?? librarySize ?? 0).toLocaleString()} reflexes
          </span>
        </div>
        {err && <p className="mt-3 text-[12px] text-danger">Benchmark failed: {err}. Is the server running?</p>}
        {bench && bench.librarySize === 0 && (
          <p className="mt-3 text-[12px] text-graphite">The reflex library is empty. Run a task first, then measure.</p>
        )}
        {bench && bench.librarySize > 0 && (
          <div className="mt-4">
            <div className={`${GRID} border-b border-ink pb-1`}>
              <span className="rx-label">Method</span>
              <span className="rx-label text-right">p50</span>
              <span className="rx-label text-right">p99</span>
              <span className="rx-label">Latency</span>
            </div>
            <Line name="Moss" note="in-process vector index" stats={bench.moss} max={max} color="var(--reflex)" />
            <Line
              name="Brute force"
              note="exact scan of every vector"
              stats={bench.brute}
              max={max}
              color="var(--llm)"
            />
            <p className="mt-2.5 text-[12px] leading-[1.5] text-muted">
              Measured just now on this server. The same 200 stored vectors are the queries for both, so embedding
              time is excluded.{" "}
              {ratio != null && ratio >= 1.2 ? (
                <span className="text-ink">Moss is {ratio.toFixed(1)}× faster at the median at this library size.</span>
              ) : (
                "At this library size a linear scan is still competitive; the gap grows with the library."
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
