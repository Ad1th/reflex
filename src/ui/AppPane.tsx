import type { ReactNode, Ref } from "react";
import type { Phase, RunStatus, Variant } from "./model";

const PHASE_TEXT: Record<Phase, string> = {
  parsing: "Reading the task",
  running: "Operating the app",
  learning: "Saving new reflexes",
  done: "Done",
};

/** The target app, rendered flush, with one line of context above it. */
export function AppPane({
  route,
  variant,
  phase,
  status,
  elapsedMs,
  containerRef,
  children,
}: {
  route: string;
  variant: Variant;
  phase?: Phase;
  status?: RunStatus;
  elapsedMs?: number;
  containerRef: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const running = status === "running";
  const statusText = phase
    ? status === "stopped"
      ? "Stopped"
      : status === "error"
        ? "Failed"
        : PHASE_TEXT[phase]
    : "Idle";
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-baseline gap-5 border-b border-rule px-10 pt-[15px] text-[12.5px]">
        <span className="min-w-0 truncate font-mono text-[12px]">
          <span className="text-muted">slotly.app</span>
          <span className="text-ink">{route}</span>
        </span>
        {variant !== "normal" && (
          <span className="shrink-0 text-graphite italic">
            {variant === "shuffled" ? "with its layout shuffled" : "with its labels renamed"}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-baseline gap-4">
          <span className={running ? "text-ink" : status === "error" ? "text-danger" : "text-muted"}>
            {running && <span aria-hidden className="rx-pulse mr-2 inline-block size-[6px] -translate-y-px rounded-full bg-ink" />}
            {statusText}
          </span>
          {elapsedMs != null && (
            <span className="tnum w-[48px] text-right font-mono text-[12px] text-ink">{(elapsedMs / 1000).toFixed(1)} s</span>
          )}
        </span>
      </div>
      <div ref={containerRef} className="rx-scroll relative min-h-0 flex-1 overflow-auto">
        {children}
      </div>
    </section>
  );
}
