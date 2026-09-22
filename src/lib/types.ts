// Shared contracts for Reflex. Every lane imports from here; change only via the orchestrator.

/** Task parameters extracted from the natural-language instruction. */
export type Slots = Record<string, string>; // e.g. { name: "Priya Sharma", email: "priya@acme.com", day: "Thursday", time: "3:00 PM", type: "Demo call" }

/** One interactive element as the agent sees it. `id` is assigned per snapshot (data-rx-id) and is NOT stable across snapshots. */
export interface PageElement {
  id: string;                       // "e7"
  role: "button" | "link" | "textbox" | "textarea" | "checkbox" | "select" | "option";
  label: string;                    // accessible name / visible text, trimmed
  value?: string;                   // current value for textbox/textarea/select; "checked"/"unchecked" for checkbox
  options?: string[];               // for select
  disabled?: boolean;
}

/** Snapshot of the target app. */
export interface PageState {
  route: string;                    // logical route from the target app root's data-route, e.g. "/book/details"
  heading: string;                  // main h1/h2 text
  elements: PageElement[];
}

/** Action vocabulary shared by LLM tools and reflexes. Targets are addressed by role+label (stable) not by id. */
export type Action =
  | { kind: "click"; role: PageElement["role"]; label: string }
  | { kind: "type"; role: "textbox" | "textarea"; label: string; text: string }
  | { kind: "select"; role: "select"; label: string; option: string }
  | { kind: "check"; role: "checkbox"; label: string; checked: boolean }
  | { kind: "done"; summary?: string };

/** A learned reflex. Labels/text/option values are TEMPLATED: occurrences of slot values are replaced by "{slot}". */
export interface Reflex {
  id: string;
  flow: string;                     // task family key, = templated goal, e.g. "Book a {type} for {name} ({email}) on {day} at {time}"
  preKey: string;                   // templated text that was embedded (see stateKey())
  action: Action;                   // templated
  postSignature: string;            // templated signature of the page AFTER the action (see signature())
  hits: number;
  misses: number;
  createdAt: number;
  source: "live" | "synthetic";
}

/** Engine lookup request/response. */
export interface LookupRequest { flow: string; stateKey: string; }
export interface LookupResponse {
  match: null | { reflex: Reflex; score: number };
  candidates: { id: string; score: number }[]; // top-3 for the UI
  timings: { embedMs: number; mossMs: number; totalMs: number };
  librarySize: number;
}

export interface LearnRequest { flow: string; stateKey: string; action: Action; postSignature: string; }
export interface FeedbackRequest { reflexId: string; ok: boolean; }

/** LLM step request/response (server calls Groq with tool calling). */
export interface LlmStepRequest { goal: string; slots: Slots; page: PageState; history: string[]; }
export interface LlmStepResponse { action: Action; reasoning?: string; ms: number; model: string; }

export interface ParseRequest { instruction: string; }
export interface ParseResponse { slots: Slots; flowTemplate: string; ms: number; model: string; }

/** Emitted by the agent loop for the UI timeline. */
export type StepSource = "reflex" | "llm" | "fallback"; // fallback = reflex candidate rejected, LLM took over
export interface StepEvent {
  runId: string;
  index: number;
  source: StepSource;
  action: Action;                   // concrete (slots filled)
  rejectReason?: "low_score" | "target_missing" | "postcondition_failed";
  score?: number;
  timings: { embedMs?: number; mossMs?: number; lookupMs?: number; llmMs?: number; actMs: number; totalMs: number };
  route: string;
}
export interface RunSummary {
  runId: string;
  instruction: string;
  steps: StepEvent[];
  llmCalls: number;                 // including the parse call
  reflexHits: number;
  wallMs: number;
  ok: boolean;
  error?: string;
}
