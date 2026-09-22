// Agent-lane-only types. Extends the shared contracts without changing them.
import type { RunSummary, Slots } from "@/lib/types";

export type Phase = "parsing" | "running" | "learning" | "done";
export interface PhaseInfo { slots?: Slots; flow?: string; }

/** RunSummary plus extra diagnostics. Structurally assignable to RunSummary. */
export interface RunSummaryExt extends RunSummary {
  slots: Slots;
  flow: string;
  parseMs: number;      // round trip of /api/llm/parse
  learned: number;      // reflexes posted to /api/reflex/learn (successfully)
  visualDelayMs: number; // total time spent in visual delays (included in wallMs)
}
