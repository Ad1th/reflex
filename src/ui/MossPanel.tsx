"use client";

import { useState } from "react";
import { fmtMs } from "./model";

interface Bench {
  librarySize: number;
  moss: { p50: number; p99: number };
  brute: { p50: number; p99: number };
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[34px_1fr_64px] items-center gap-3 text-[12px]">
      <span className="text-muted">{label}</span>
      <svg width="100%" height="10" aria-hidden>
        <rect width="100%" height="10" rx="2" fill="var(--rule-soft)" />
        <rect width={`${Math.max(0.6, (value / max) * 100)}%`} height="10" rx="2" fill={color} />
      </svg>
      <span className="tnum text-right font-semibold text-ink">{fmtMs(value)}</span>
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
    <div className="absolute inset-x-0 top-0 z-20 flex justify-end p-4" role="dialog" aria-label="Why Moss">
      <div className="rx-pop w-[460px] rounded-xl border border-rule bg-panel-2 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-start">
          <h2 className="text-[17px] font-semibold tracking-tight">Why Moss</h2>
          <button onClick={onClose} className="ml-auto text-[13px] text-muted hover:text-ink" aria-label="Close">
            Close
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-[1.5] text-muted">
          Before every step the agent asks: have I been in this exact situation before? That question
          runs on every click, so it has to cost less than a millisecond. Moss answers it from an
          in-process vector index; the LLM is only called when there is no confident answer.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="h-8 rounded-md bg-ink px-3.5 text-[13px] font-semibold text-night hover:bg-white disabled:opacity-50"
          >
            {busy ? "Measuring…" : bench ? "Measure again" : "Measure lookups"}
          </button>
          <span className="tnum text-[12px] text-faint">
            200 queries against {(bench?.librarySize ?? librarySize ?? 0).toLocaleString()} reflexes
          </span>
        </div>
        {err && <p className="mt-3 text-[12px] text-danger">Benchmark failed: {err}. Is the server running?</p>}
        {bench && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-semibold text-reflex">Moss, in-process index</div>
              <Bar label="p50" value={bench.moss.p50} max={max} color="var(--reflex)" />
              <Bar label="p99" value={bench.moss.p99} max={max} color="var(--reflex)" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-semibold text-muted">Brute force, exact scan of every vector (typed-array dot products)</div>
              <Bar label="p50" value={bench.brute.p50} max={max} color="var(--faint)" />
              <Bar label="p99" value={bench.brute.p99} max={max} color="var(--faint)" />
            </div>
            <p className="text-[12px] leading-[1.5] text-faint">
              Measured just now on this server: the same 200 stored vectors are used as queries for both, so embedding time is excluded.{" "}
              {ratio != null && ratio >= 1.2
                ? `Moss is ${ratio.toFixed(1)}× faster at the median at this library size.`
                : "At this library size a linear scan is still competitive; the gap grows with the library."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
