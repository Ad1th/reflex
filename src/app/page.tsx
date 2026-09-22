"use client";

import { useEffect, useRef, useState } from "react";
import { runTask } from "@/agent/loop";
import type { StepEvent } from "@/lib/types";
import { SlotlyApp } from "@/target/SlotlyApp";
import { BrowserFrame } from "@/ui/BrowserFrame";
import { Controls } from "@/ui/Controls";
import { Header } from "@/ui/Header";
import { median, PRESETS, type Phase, type RunRecord, type Variant } from "@/ui/model";
import { MossPanel } from "@/ui/MossPanel";
import { RunHistory } from "@/ui/RunHistory";
import { Timeline } from "@/ui/Timeline";

interface Stats {
  librarySize: number;
  live: number;
  synthetic: number;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export default function Home() {
  const [instruction, setInstruction] = useState<string>(PRESETS[0].text);
  const [variant, setVariant] = useState<Variant>("normal");
  const [turbo, setTurbo] = useState(false);
  const [threshold, setThreshold] = useState(0.9);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selected, setSelected] = useState<number>();
  const [appKey, setAppKey] = useState(0);
  const [route, setRoute] = useState("/");
  const [stats, setStats] = useState<Stats>();
  const [mossOpen, setMossOpen] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [now, setNow] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const latest = runs.at(-1);
  const running = latest?.status === "running";

  async function refreshStats() {
    try {
      const res = await fetch("/api/reflex/stats", { cache: "no-store" });
      if (res.ok) setStats((await res.json()) as Stats);
    } catch {
      /* server not up yet; keep last value */
    }
  }

  // Library size: poll quickly while a run is learning, slowly otherwise.
  useEffect(() => {
    const first = setTimeout(refreshStats, 0);
    const id = setInterval(refreshStats, running ? 1000 : 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running]);

  // Live wall clock while running.
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(performance.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 100);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running]);

  function patch(n: number, f: (r: RunRecord) => Partial<RunRecord>) {
    setRuns((rs) => rs.map((r) => (r.n === n ? { ...r, ...f(r) } : r)));
  }

  async function run() {
    const text = instruction.trim();
    if (!text || running) return;
    const n = runs.length + 1;
    const startedAt = performance.now();
    setRuns((rs) => [
      ...rs,
      { n, instruction: text, variant, phase: "parsing", startedAt, steps: [], status: "running" },
    ]);
    setSelected(undefined);
    setNow(startedAt);
    setRoute("/");
    setAppKey((k) => k + 1); // fresh app state for every run
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    await nextFrame();

    let parseStart = performance.now();
    try {
      const summary = await runTask({
        instruction: text,
        threshold,
        visualDelayMs: turbo ? 0 : 250,
        signal: ctrl.signal,
        getRoot: () => {
          const el = containerRef.current?.querySelector<HTMLElement>("[data-rx-root]");
          if (!el) throw new Error("target app is not mounted");
          return el;
        },
        onPhase: (p: Phase, info) => {
          const t = performance.now();
          if (p === "parsing") parseStart = t;
          patch(n, (r) => ({
            phase: p,
            ...(info?.flow ? { flow: info.flow } : {}),
            ...(info?.slots ? { slots: info.slots } : {}),
            ...(p === "running" && r.parseMs == null ? { parseMs: t - parseStart } : {}),
          }));
        },
        onEvent: (e: StepEvent) => patch(n, (r) => ({ steps: [...r.steps, e] })),
      });
      const aborted = ctrl.signal.aborted;
      patch(n, () => ({
        runId: summary.runId,
        steps: summary.steps,
        // agent time: exclude the artificial per-step display delay so speedups are honest
        wallMs: summary.wallMs - (summary.visualDelayMs ?? 0),
        llmCalls: summary.llmCalls,
        reflexHits: summary.reflexHits,
        phase: "done",
        status: summary.ok ? "done" : aborted ? "stopped" : "error",
        error: summary.error,
        ...(summary.parseMs ? { parseMs: summary.parseMs } : {}),
        ...(summary.flow ? { flow: summary.flow } : {}),
      }));
    } catch (e) {
      patch(n, (r) => ({
        phase: "done",
        status: ctrl.signal.aborted ? "stopped" : "error",
        error: e instanceof Error ? e.message : String(e),
        wallMs: performance.now() - r.startedAt,
      }));
    } finally {
      abortRef.current = null;
      refreshStats();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function forget() {
    setForgetting(true);
    try {
      await fetch("/api/reflex/reset", { method: "POST" });
      setRuns([]);
      setSelected(undefined);
      setAppKey((k) => k + 1);
      setRoute("/");
    } finally {
      setForgetting(false);
      refreshStats();
    }
  }

  // Session-wide numbers for the header.
  const allSteps = runs.flatMap((r) => r.steps);
  const llmStepMs = allSteps.filter((s) => s.source !== "reflex" && s.timings.llmMs != null).map((s) => s.timings.llmMs!);
  const avgLlm = llmStepMs.length ? llmStepMs.reduce((a, b) => a + b, 0) / llmStepMs.length : 0;
  const reflexSteps = allSteps.filter((s) => s.source === "reflex");
  const mossTimes = allSteps.map((s) => s.timings.mossMs).filter((x): x is number => x != null);

  const shown = selected != null ? runs.find((r) => r.n === selected) : latest;
  const elapsed = latest ? (latest.wallMs ?? Math.max(0, now - latest.startedAt)) : undefined;

  return (
    <div className="flex h-dvh min-h-[760px] flex-col overflow-hidden">
      <Header
        stats={{
          librarySize: stats?.librarySize,
          live: stats?.live,
          synthetic: stats?.synthetic,
          llmAvoided: reflexSteps.length,
          timeSavedMs: reflexSteps.length * avgLlm,
          mossP50: median(mossTimes),
        }}
        onOpenMoss={() => setMossOpen((o) => !o)}
      />
      <main className="relative flex min-h-0 flex-1 gap-5 p-5">
        <div className="flex min-h-0 min-w-0 basis-[55%] flex-col">
          <BrowserFrame
            route={route}
            variant={variant}
            phase={latest?.phase}
            status={latest?.status}
            elapsedMs={elapsed}
            containerRef={containerRef}
          >
            <SlotlyApp key={`${appKey}-${variant}`} variant={variant} onRouteChange={setRoute} />
          </BrowserFrame>
        </div>
        <div className="flex min-h-0 min-w-0 basis-[45%] flex-col gap-3">
          <Controls
            instruction={instruction}
            setInstruction={setInstruction}
            variant={variant}
            setVariant={setVariant}
            turbo={turbo}
            setTurbo={setTurbo}
            threshold={threshold}
            setThreshold={setThreshold}
            running={running}
            onRun={run}
            onStop={stop}
          />
          <Timeline run={shown} isLatest={shown === latest} />
          <RunHistory
            runs={runs}
            now={now}
            selected={shown?.n}
            onSelect={(n) => setSelected(n === latest?.n ? undefined : n)}
            onForget={forget}
            forgetting={forgetting}
            canForget={!running}
          />
        </div>
        <MossPanel open={mossOpen} onClose={() => setMossOpen(false)} librarySize={stats?.librarySize} />
      </main>
    </div>
  );
}
