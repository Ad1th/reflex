import type { Action, StepEvent } from "@/lib/types";
type Opts = Parameters<typeof import("@/agent/loop").runTask>[0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
export async function runTask(o: Opts) {
  calls++;
  const runId = "r" + calls;
  const t0 = performance.now();
  o.onPhase?.("parsing");
  await sleep(600);
  const slots = { name: "Priya Sharma", email: "priya@acme.io", day: "Thursday", time: "3:00 PM", type: "Demo call", team: "11-50" };
  o.onPhase?.("running", { slots, flow: "book" });
  const acts: Action[] = [
    { kind: "click", role: "button", label: "Demo call" },
    { kind: "click", role: "button", label: "Thursday" },
    { kind: "click", role: "button", label: "3:00 PM" },
    { kind: "type", role: "textbox", label: "Full name", text: "Priya Sharma" },
    { kind: "type", role: "textbox", label: "Work email", text: "priya@acme.io" },
    { kind: "select", role: "select", label: "Team size", option: "11-50" },
    { kind: "check", role: "checkbox", label: "I agree to the terms", checked: true },
    { kind: "click", role: "button", label: "Confirm booking" },
    { kind: "done", summary: "Booked" },
  ];
  const steps: StepEvent[] = [];
  for (let i = 0; i < acts.length; i++) {
    const src = calls === 1 ? "llm" : i === 3 && calls > 2 ? "fallback" : "reflex";
    await sleep(src === "reflex" ? 120 : 400);
    const e: StepEvent = { runId, index: i, source: src, action: acts[i], route: "/x", score: 0.97,
      rejectReason: src === "fallback" ? "target_missing" : undefined,
      timings: src === "reflex" ? { embedMs: 4, mossMs: 0.6 + Math.random() * 0.3, lookupMs: 6 + Math.random() * 3, actMs: 20, totalMs: 30 } : { llmMs: 3100 + Math.random() * 900, actMs: 20, totalMs: 3200 } };
    steps.push(e); o.onEvent?.(e);
  }
  o.onPhase?.("learning", { slots, flow: "book" });
  await sleep(200);
  o.onPhase?.("done", { slots, flow: "book" });
  const real = calls === 1 ? 38200 : calls === 2 ? 2100 : 5400;
  void t0;
  return { runId, instruction: o.instruction, steps, llmCalls: 1 + steps.filter((s) => s.source !== "reflex").length, reflexHits: steps.filter((s) => s.source === "reflex").length, wallMs: real, ok: true, slots, flow: "book", parseMs: 812, learned: 9, visualDelayMs: 0 };
}
