import type { Slots, StepEvent } from "@/lib/types";

export type Variant = "normal" | "shuffled" | "renamed";
export type Phase = "parsing" | "running" | "learning" | "done";
export type RunStatus = "running" | "done" | "stopped" | "error";

/** One agent run as the UI tracks it. */
export interface RunRecord {
  n: number; // 1-based run number in this session
  runId?: string;
  instruction: string;
  variant: Variant;
  flow?: string;
  slots?: Slots;
  phase: Phase;
  startedAt: number;
  parseMs?: number;
  steps: StepEvent[];
  status: RunStatus;
  wallMs?: number;
  llmCalls?: number;
  reflexHits?: number;
  error?: string;
}

export const PRESETS = [
  {
    key: "R1",
    who: "Priya",
    what: "Demo call",
    text: "Book a Demo call for Priya Sharma (priya@acme.io) on Thursday at 3:00 PM, team size 11-50.",
  },
  {
    key: "R2",
    who: "Arjun",
    what: "Demo call",
    text: "Book a Demo call for Arjun Mehta (arjun@zeta.dev) on Friday at 10:00 AM, team size 51-200.",
  },
  {
    key: "R3",
    who: "Meera",
    what: "Onboarding",
    text: "Schedule an Onboarding session for Meera Nair, meera@orbit.in, Monday 2:00 PM, team of 1-10.",
  },
] as const;

export const VARIANTS: { value: Variant; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "shuffled", label: "Shuffled layout" },
  { value: "renamed", label: "Renamed labels" },
];

export function stepLlmCount(steps: StepEvent[]) {
  return steps.filter((s) => s.source !== "reflex").length;
}
export function stepReflexCount(steps: StepEvent[]) {
  return steps.filter((s) => s.source === "reflex").length;
}

/** LLM calls for a run: the summary's number once finished, else parse + LLM steps so far. */
export function runLlmCalls(r: RunRecord) {
  if (r.llmCalls != null) return r.llmCalls;
  return (r.parseMs != null || r.phase !== "parsing" ? 1 : 0) + stepLlmCount(r.steps);
}

export function median(xs: number[]) {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function fmtSec(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtMs(ms: number | undefined) {
  if (ms == null) return "–";
  if (ms < 1) return `${ms.toFixed(ms < 0.1 ? 3 : 2)}ms`;
  if (ms < 10) return `${ms.toFixed(1)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const REJECT_TEXT: Record<NonNullable<StepEvent["rejectReason"]>, string> = {
  low_score: "no confident match",
  target_missing: "remembered target not on page",
  postcondition_failed: "landed somewhere unexpected",
};
