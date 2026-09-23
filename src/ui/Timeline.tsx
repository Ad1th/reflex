"use client";

import { useEffect, useRef } from "react";
import { describeAction } from "@/lib/templating";
import type { StepEvent } from "@/lib/types";
import { fmtMs, REJECT_TEXT, type RunRecord } from "./model";

type Kind = "llm" | "reflex" | "fallback";

const WORD: Record<Kind, string> = { llm: "llm", reflex: "reflex", fallback: "fallback" };

const GRID = "grid grid-cols-[22px_64px_minmax(0,1fr)_auto] gap-x-3";

export function SourceMark({ kind, flash }: { kind: Kind; flash?: boolean }) {
  return (
    <span
      className={`rx-smcp leading-[20px] ${
        kind === "reflex" ? `text-reflex ${flash ? "rx-flash" : ""}` : kind === "fallback" ? "text-graphite italic" : "text-ink"
      }`}
    >
      {WORD[kind]}
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
    <li className={`rx-row ${GRID} items-baseline py-[3px]`}>
      <span className="tnum text-right font-mono text-[11.5px] leading-[20px] text-faint">{n}</span>
      <SourceMark kind={kind} flash={flash} />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] leading-[20px] text-ink" title={main}>
          {main}
        </span>
        {sub && <span className="block text-[12.5px] leading-[18px] text-graphite italic">{sub}</span>}
      </span>
      <span className="tnum text-right font-mono text-[12px] leading-[20px] whitespace-nowrap">
        {msSub && <span className="mr-3 text-faint">{msSub}</span>}
        <span className={`inline-block min-w-[48px] ${kind === "reflex" ? "text-reflex" : "text-ink"}`}>{ms}</span>
      </span>
    </li>
  );
}

function stepRow(s: StepEvent) {
  const t = s.timings;
  const desc = describeAction(s.action);
  const key = `${s.runId}-${s.index}`;
  if (s.source === "reflex") {
    return (
      <Row
        key={key}
        n={String(s.index + 1)}
        kind="reflex"
        main={desc}
        ms={fmtMs(t.lookupMs ?? t.totalMs)}
        msSub={t.mossMs != null ? `moss ${t.mossMs.toFixed(1)}` : undefined}
        flash
      />
    );
  }
  if (s.source === "fallback") {
    const why = s.rejectReason ? REJECT_TEXT[s.rejectReason] : "reflex rejected";
    return (
      <Row
        key={key}
        n={String(s.index + 1)}
        kind="fallback"
        main={desc}
        sub={`Reflex rejected: ${why}${s.score != null ? ` (score ${s.score.toFixed(2)})` : ""}. The LLM took over.`}
        ms={fmtMs(t.llmMs ?? t.totalMs)}
      />
    );
  }
  return <Row key={key} n={String(s.index + 1)} kind="llm" main={desc} ms={fmtMs(t.llmMs ?? t.totalMs)} />;
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
  const reasoned = run ? run.steps.length - reflexes : 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-rule pt-5">
      <div className="flex shrink-0 items-baseline gap-4 pb-2">
        <h2 className="text-[15px] font-medium text-ink">{run ? `Run ${run.n}` : "Steps"}</h2>
        {run && (
          <span className="text-[13px] text-muted">
            <span className="tnum text-ink">{reasoned}</span> reasoned by the LLM,{" "}
            <span className="tnum text-reflex">{reflexes}</span> replayed as reflexes
          </span>
        )}
      </div>
      <ol ref={listRef} className="rx-scroll min-h-0 flex-1 overflow-y-auto">
        {!run && (
          <li className="max-w-[46ch] py-2 text-[14px] leading-[1.55] text-graphite">
            Pick a task and run the agent. The first run reasons through every step with the LLM. Run a similar task
            again and those steps come back as reflexes.
          </li>
        )}
        {run && <Row n="0" kind="llm" main="Read the task into fields" ms={run.parseMs != null ? fmtMs(run.parseMs) : "…"} />}
        {run && slotText && (
          <li className={`rx-row ${GRID} pb-1.5`}>
            <span />
            <span />
            <span className="col-span-2 truncate font-mono text-[11.5px] leading-[18px] text-muted" title={slotText}>
              {slotText}
            </span>
          </li>
        )}
        {run?.steps.map(stepRow)}
        {run?.status === "running" && run.phase !== "parsing" && (
          <li className={`${GRID} items-baseline py-[3px] text-[13.5px] leading-[20px] text-muted`}>
            <span />
            <span aria-hidden className="rx-pulse rx-smcp">
              …
            </span>
            <span>{run.phase === "learning" ? "Saving new steps as reflexes" : "Looking up the next step"}</span>
          </li>
        )}
        {run && run.status !== "running" && (
          <li className={`${GRID} pt-2 pb-1 text-[13.5px]`}>
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
