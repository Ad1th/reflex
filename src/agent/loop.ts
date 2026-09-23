import type {
  Action, LlmStepResponse, LookupResponse, PageState, ParseResponse, RunSummary, Slots, StepEvent, StepSource,
} from "@/lib/types";
import { describeAction, fillAction, signature, stateKey, templatizeAction } from "@/lib/templating";
import { snapshot } from "./snapshot";
import { execute, highlight, resolve, settle } from "./executor";
import type { Phase, PhaseInfo, RunSummaryExt } from "./types";

export interface RunTaskOptions {
  instruction: string;
  getRoot: () => HTMLElement;
  threshold?: number;      // default 0.9
  visualDelayMs?: number;  // default 250
  maxSteps?: number;       // default 25
  signal?: AbortSignal;
  onEvent?: (e: StepEvent) => void;
  onPhase?: (p: Phase, info?: PhaseInfo) => void;
}

class RunError extends Error {}
const now = () => performance.now();
const newRunId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(new RunError("aborted"));
    const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); res(); }, ms);
    const onAbort = () => { clearTimeout(t); rej(new RunError("aborted")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal?.aborted) throw new RunError("aborted");
    throw e;
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new RunError(`${url} -> HTTP ${res.status}${txt ? `: ${txt.slice(0, 300)}` : ""}`);
  }
  return (await res.json()) as T;
}

/** Fire-and-forget POST (feedback). Never throws. */
function postQuiet(url: string, body: unknown): Promise<boolean> {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.ok).catch(() => false);
}

export async function runTask(opts: RunTaskOptions): Promise<RunSummaryExt> {
  const { instruction, getRoot, signal, onEvent, onPhase } = opts;
  const threshold = opts.threshold ?? 0.9;
  const visualDelayMs = opts.visualDelayMs ?? 250;
  const maxSteps = opts.maxSteps ?? 25;

  const runId = newRunId();
  const t0 = now();
  const steps: StepEvent[] = [];
  const history: string[] = [];
  const learnPromises: Promise<boolean>[] = [];
  const repeats = new Map<string, number>();
  let llmCalls = 0, reflexHits = 0, parseMs = 0, visualTotal = 0;
  let slots: Slots = {};
  let flow = "";

  const finish = async (ok: boolean, error?: string): Promise<RunSummaryExt> => {
    onPhase?.("learning", { slots, flow });
    const results = await Promise.all(learnPromises);
    onPhase?.("done", { slots, flow });
    return {
      runId, instruction, steps, llmCalls, reflexHits, wallMs: now() - t0, ok, ...(error ? { error } : {}),
      slots, flow, parseMs, learned: results.filter(Boolean).length, visualDelayMs: visualTotal,
    };
  };

  const checkAbort = () => { if (signal?.aborted) throw new RunError("aborted"); };

  const emit = (e: Omit<StepEvent, "runId" | "index">) => {
    const ev: StepEvent = { runId, index: steps.length, ...e };
    steps.push(ev);
    onEvent?.(ev);
  };

  /** Highlight during the visual delay, then act + settle. Returns actMs (excl. delay). */
  const act = async (el: HTMLElement, action: Action, source: StepSource): Promise<number> => {
    const unhl = highlight(el, `${source === "reflex" ? "reflex" : source === "fallback" ? "fallback" : "llm"}  ${describeAction(action)}`, source === "reflex" ? "#2743c4" : "#1f1f1f");
    try {
      const d0 = now();
      await sleep(visualDelayMs, signal);
      visualTotal += now() - d0;
      const a0 = now();
      await execute(el, action, { highlight: false });
      await settle();
      return now() - a0;
    } finally {
      setTimeout(unhl, 200);
    }
  };

  const learn = (key: string, action: Action, post: PageState) => {
    learnPromises.push(postQuiet("/api/reflex/learn", {
      flow, stateKey: key, action: templatizeAction(action, slots), postSignature: signature(post, slots),
    }));
  };

  try {
    // a. parse
    onPhase?.("parsing");
    const p0 = now();
    const parsed = await post<ParseResponse>("/api/llm/parse", { instruction }, signal);
    parseMs = now() - p0;
    llmCalls = 1;
    slots = parsed.slots ?? {};
    flow = parsed.flowTemplate;
    onPhase?.("running", { slots, flow });

    // b. loop
    for (let step = 0; step < maxSteps; step++) {
      checkAbort();
      const stepStart = now();
      const visualBefore = visualTotal;
      const root = getRoot();
      const page = snapshot(root);
      const key = stateKey(flow, page, slots);

      const l0 = now();
      const lookup = await post<LookupResponse>("/api/reflex/lookup", { flow, stateKey: key, threshold }, signal);
      const lookupMs = now() - l0;
      const base = { lookupMs, embedMs: lookup.timings?.embedMs, mossMs: lookup.timings?.mossMs };

      let source: StepSource = "llm";
      let rejectReason: StepEvent["rejectReason"];
      const score: number | undefined = lookup.match?.score ?? lookup.candidates?.[0]?.score;
      if (!lookup.match && lookup.candidates?.length) rejectReason = "low_score";

      const guard = (action: Action) => {
        const k = `${key}\u0000${describeAction(action)}`;
        const c = (repeats.get(k) ?? 0) + 1;
        repeats.set(k, c);
        if (c >= 3) throw new RunError("loop detected");
      };

      // ---- Reflex path
      if (lookup.match) {
        const reflex = lookup.match.reflex;
        const action = fillAction(reflex.action, slots);
        if (action.kind === "done") {
          if (signature(page, slots) === reflex.postSignature) {
            void postQuiet("/api/reflex/feedback", { reflexId: reflex.id, ok: true });
            reflexHits++;
            history.push(describeAction(action));
            emit({ source: "reflex", action, score, timings: { ...base, actMs: 0, totalMs: now() - stepStart }, route: page.route });
            return await finish(true);
          }
          void postQuiet("/api/reflex/feedback", { reflexId: reflex.id, ok: false });
          source = "fallback"; rejectReason = "postcondition_failed";
        } else {
          const el = resolve(root, action);
          if (!el) {
            void postQuiet("/api/reflex/feedback", { reflexId: reflex.id, ok: false });
            source = "fallback"; rejectReason = "target_missing";
          } else {
            guard(action);
            const actMs = await act(el, action, "reflex");
            const newPage = snapshot(getRoot());
            const ok = signature(newPage, slots) === reflex.postSignature;
            void postQuiet("/api/reflex/feedback", { reflexId: reflex.id, ok });
            if (ok) reflexHits++;
            history.push(describeAction(action));
            emit({
              source: "reflex", action, score, ...(ok ? {} : { rejectReason: "postcondition_failed" as const }),
              timings: { ...base, actMs, totalMs: now() - stepStart - (visualTotal - visualBefore) }, route: newPage.route,
            });
            continue;
          }
        }
      }

      // ---- LLM path (no match, or fallback)
      let llmMs = 0;
      let action: Action | null = null;
      let el: HTMLElement | null = null;
      const extraHistory: string[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        checkAbort();
        const res = await post<LlmStepResponse>("/api/llm/step", { goal: instruction, slots, page, history: [...history, ...extraHistory] }, signal);
        llmCalls++;
        llmMs += res.ms ?? 0;
        action = res.action;
        if (action.kind === "done") break;
        el = resolve(getRoot(), action);
        if (el) break;
        extraHistory.push(`ERROR: could not find a unique ${action.role} labelled "${action.label}" on this page. Use an exact role+label from the elements list.`);
      }
      if (!action) throw new RunError("LLM returned no action");

      if (action.kind === "done") {
        learn(key, action, page);
        history.push(describeAction(action));
        emit({ source, action, rejectReason, score, timings: { ...base, llmMs, actMs: 0, totalMs: now() - stepStart }, route: page.route });
        return await finish(true);
      }
      if (!el) {
        emit({ source, action, rejectReason, score, timings: { ...base, llmMs, actMs: 0, totalMs: now() - stepStart }, route: page.route });
        throw new RunError(`target not found: ${describeAction(action)}`);
      }
      guard(action);
      const actMs = await act(el, action, source);
      const newPage = snapshot(getRoot());
      learn(key, action, newPage);
      history.push(describeAction(action));
      emit({
        source, action, rejectReason, score,
        timings: { ...base, llmMs, actMs, totalMs: now() - stepStart - (visualTotal - visualBefore) }, route: newPage.route,
      });
    }
    return await finish(false, `max steps (${maxSteps}) reached`);
  } catch (e) {
    const msg = signal?.aborted ? "aborted" : e instanceof Error ? e.message : String(e);
    return await finish(false, msg);
  }
}

export type { RunSummary };
