"use client";

import { useEffect, useRef } from "react";
import { describeAction } from "@/lib/templating";
import type { StepEvent } from "@/lib/types";
import { fmtMs, REJECT_TEXT, type RunRecord } from "./model";

const SOURCE = {
  llm: { text: "LLM", square: "bg-llm", ink: "text-llm" },
  reflex: { text: "REFLEX", square: "bg-reflex", ink: "text-reflex" },
  fallback: { text: "FALLBACK", square: "bg-fallback", ink: "text-fallback" },
} as const;

type Kind = keyof typeof SOURCE;

const GRID = "grid grid-cols-[24px_88px_1fr_132px] gap-3 px-3";

export function SourceMark({ kind }: { kind: Kind }) {
  const s = SOURCE[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.04em] ${s.ink}`}>
      <span aria-hidden className={`size-[7px] shrink-0 ${s.square}`} />
      {s.text}
    </span>
  );
}

function Row({
  n,
  kind,
  main,
  sub,
  ms,
  msSub,
  flash,
}: {
  n: string;
  kind: Kind;
  main: string;
  sub?: string;
  ms: string;
  msSub?: string;
  flash?: boolean;
}) {
  return (
    <li className={`rx-row ${GRID} items-baseline border-b border-rule-soft py-[4px] ${flash ? "rx-flash" : ""}`}>
      <span className="tnum text-right font-mono text-[11px] text-faint">{n}</span>
      <SourceMark kind={kind} />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12px] leading-[18px] text-ink" title={main}>
          {main}
        </span>
        {sub && <span className="block truncate text-[11.5px] leading-4 text-fallback">{sub}</span>}
      </span>
      <span className="tnum text-right font-mono text-[12px] leading-[18px] whitespace-nowrap">
        {msSub && <span className="mr-2 text-[10.5px] text-faint">{msSub}</span>}
        <span className={`inline-block min-w-[44px] ${kind === "reflex" ? "font-medium text-reflex" : "text-ink"}`}>{ms}</span>
      </span>
    </li>
  );
}

function stepRow(s: StepEvent) {
  const t = s.timings;
  const desc = describeAction(s.action);
  if (s.source === "reflex") {
    return (
      <Row
        key={`${s.runId}-${s.index}`}
        n={String(s.index + 1)}
        kind="reflex"
        main={desc}
        ms={fmtMs(t.lookupMs ?? t.totalMs)}
        msSub={t.mossMs != null ? `moss ${t.mossMs.toFixed(1)}ms` : undefined}
        flash
      />
    );
  }
  if (s.source === "fallback") {
    const why = s.rejectReason ? REJECT_TEXT[s.rejectReason] : "reflex rejected";
    return (
      <Row
        key={`${s.runId}-${s.index}`}
        n={String(s.index + 1)}
        kind="fallback"
        main={desc}
        sub={`Reflex rejected: ${why}${s.score != null ? ` (score ${s.score.toFixed(2)})` : ""}. LLM took over.`}
        ms={fmtMs(t.llmMs ?? t.totalMs)}
      />
    );
  }
  return (
    <Row key={`${s.runId}-${s.index}`} n={String(s.index + 1)} kind="llm" main={desc} ms={fmtMs(t.llmMs ?? t.totalMs)} />
  );
}

export function Timeline({ run, isLatest }: { run?: RunRecord; isLatest: boolean }) {
  const listRef = useRef<HTMLOListElement>(null);
  const count = run?.steps.length ?? 0;
  const phase = run?.phase;

  useEffect(() => {
    const el = listRef.current;
    if (el && isLatest) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [count, phase, isLatest]);

  const slotText = run?.slots
    ? Object.entries(run.slots)
        .map(([k, v]) => `${k}=${v}`)
        .join("  ")
    : undefined;

  const reflexes = run ? run.steps.filter((s) => s.source === "reflex").length : 0;
  const llm = run ? run.steps.length - reflexes : 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-ink">
      <div className="flex h-9 shrink-0 items-baseline gap-4 pt-2.5">
        <h2 className="text-[13px] font-semibold text-ink">{run ? `Run ${run.n}, step by step` : "Steps"}</h2>
        {run && (
          <span className="tnum font-mono text-[11.5px] text-muted">
            <span className="text-llm">{llm} llm</span>
            <span className="text-faint"> / </span>
            <span className="text-reflex">{reflexes} reflex</span>
          </span>
        )}
      </div>
      <div className={`${GRID} shrink-0 border-b border-rule py-1`}>
        <span className="rx-label text-right">#</span>
        <span className="rx-label">Source</span>
        <span className="rx-label">Action</span>
        <span className="rx-label text-right">Time</span>
      </div>
      <ol ref={listRef} className="rx-scroll min-h-0 flex-1 overflow-y-auto">
        {!run && (
          <li className="max-w-[440px] px-3 py-5 text-[13px] leading-[1.55] text-graphite">
            Pick a task and run the agent. The first run reasons through every step with the LLM; run a similar
            task again and those steps come back as reflexes.
          </li>
        )}
        {run && (
          <Row n="0" kind="llm" main="parse task → slots" ms={run.parseMs != null ? fmtMs(run.parseMs) : "…"} />
        )}
        {run && slotText && (
          <li className={`rx-row ${GRID} border-b border-rule-soft py-[5px]`}>
            <span />
            <span />
            <span className="col-span-2 truncate font-mono text-[11px] text-muted" title={slotText}>
              {slotText}
            </span>
          </li>
        )}
        {run?.steps.map(stepRow)}
        {run?.status === "running" && run.phase !== "parsing" && (
          <li className={`${GRID} items-center py-2 text-[12px] text-muted`}>
            <span />
            <span aria-hidden className="rx-pulse size-[7px] bg-muted" />
            <span>{run.phase === "learning" ? "Saving new steps as reflexes" : "Looking up the next step"}</span>
          </li>
        )}
        {run && run.status !== "running" && (
          <li className={`${GRID} py-2 text-[12px]`}>
            <span />
            <span />
            <span className="col-span-2">
              {run.status === "done" && <span className="text-ink">Task complete.</span>}
              {run.status === "stopped" && <span className="text-muted">Stopped.</span>}
              {run.status === "error" && <span className="text-danger">Run failed: {run.error ?? "unknown error"}</span>}
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}
