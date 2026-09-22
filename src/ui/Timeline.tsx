"use client";

import { useEffect, useRef } from "react";
import { describeAction } from "@/lib/templating";
import type { StepEvent } from "@/lib/types";
import { fmtMs, REJECT_TEXT, type RunRecord } from "./model";

const BADGE = {
  llm: { text: "🧠 LLM", cls: "bg-llm-dim text-llm" },
  reflex: { text: "⚡ REFLEX", cls: "bg-reflex-dim text-reflex" },
  fallback: { text: "↩ FALLBACK", cls: "bg-fallback-dim text-fallback" },
} as const;

function Badge({ kind }: { kind: keyof typeof BADGE }) {
  const b = BADGE[kind];
  return (
    <span
      className={`inline-flex h-[22px] w-[92px] shrink-0 items-center justify-center rounded text-[11px] font-bold tracking-[0.04em] ${b.cls}`}
    >
      {b.text}
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
  kind: keyof typeof BADGE;
  main: string;
  sub?: string;
  ms: string;
  msSub?: string;
  flash?: boolean;
}) {
  return (
    <li
      className={`rx-row grid grid-cols-[22px_92px_1fr_auto] items-center gap-3 border-b border-rule-soft px-3 py-[7px] ${
        flash ? "rx-flash" : ""
      }`}
    >
      <span className="tnum text-right text-[11px] text-faint">{n}</span>
      <Badge kind={kind} />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[11.5px] leading-[18px] text-ink" title={main}>
          {main}
        </span>
        {sub && <span className="block truncate text-[11.5px] leading-4 text-fallback">{sub}</span>}
      </span>
      <span className="flex flex-col items-end">
        <span
          className={`tnum text-[13px] leading-[18px] font-semibold ${
            kind === "reflex" ? "text-reflex" : "text-ink"
          }`}
        >
          {ms}
        </span>
        {msSub && <span className="tnum text-[10.5px] leading-3 text-faint">{msSub}</span>}
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
        msSub="llm"
      />
    );
  }
  return (
    <Row
      key={`${s.runId}-${s.index}`}
      n={String(s.index + 1)}
      kind="llm"
      main={desc}
      ms={fmtMs(t.llmMs ?? t.totalMs)}
      msSub="llm"
    />
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-rule bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-rule px-3 text-[12px]">
        <span className="font-semibold text-ink">{run ? `Run ${run.n} steps` : "Steps"}</span>
        {run && (
          <span className="tnum text-muted">
            <span className="text-llm">{llm} LLM</span>
            <span className="text-faint"> / </span>
            <span className="text-reflex">{reflexes} reflex</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-3 text-faint">
          <span>lookup / LLM time</span>
        </span>
      </div>
      <ol ref={listRef} className="rx-scroll min-h-0 flex-1 overflow-y-auto">
        {!run && (
          <li className="flex h-full flex-col items-center justify-center gap-1 px-8 text-center">
            <span className="text-[14px] text-ink">Pick a task and run the agent.</span>
            <span className="text-[13px] text-muted">
              The first run reasons through every step with the LLM. Run a similar task again and
              watch the steps turn into reflexes.
            </span>
          </li>
        )}
        {run && (
          <Row
            n="0"
            kind="llm"
            main="parse task → slots"
            sub={undefined}
            ms={run.parseMs != null ? fmtMs(run.parseMs) : "…"}
            msSub="llm"
          />
        )}
        {run && slotText && (
          <li className="rx-row truncate border-b border-rule-soft py-1.5 pr-3 pl-[149px] font-mono text-[11px] text-muted" title={slotText}>
            {slotText}
          </li>
        )}
        {run?.steps.map(stepRow)}
        {run?.status === "running" && run.phase !== "parsing" && (
          <li className="flex items-center gap-3 px-3 py-2 text-[12px] text-muted">
            <span className="w-[22px]" />
            <span className="rx-pulse size-1.5 rounded-full bg-muted" />
            {run.phase === "learning" ? "Saving new steps as reflexes" : "Looking up the next step"}
          </li>
        )}
        {run && run.status !== "running" && (
          <li className="px-3 py-2 pl-[149px] text-[12px]">
            {run.status === "done" && <span className="text-reflex">Task complete.</span>}
            {run.status === "stopped" && <span className="text-muted">Stopped.</span>}
            {run.status === "error" && <span className="text-danger">Run failed: {run.error ?? "unknown error"}</span>}
          </li>
        )}
      </ol>
    </section>
  );
}
