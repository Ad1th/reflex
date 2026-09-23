import type { ReactNode, Ref } from "react";
import type { Phase, RunStatus, Variant } from "./model";

const PHASE_TEXT: Record<Phase, string> = {
  parsing: "Reading the task",
  running: "Operating the app",
  learning: "Saving new reflexes",
  done: "Done",
};

export function BrowserFrame({
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px] border border-rule bg-sheet">
      <div className="flex h-9 shrink-0 items-center gap-4 border-b border-rule bg-paper px-3 font-mono text-[12px]">
        <span className="min-w-0 truncate">
          <span className="text-ink">slotly.app</span>
          <span className="text-muted">{route}</span>
        </span>
        {variant !== "normal" && (
          <span className="shrink-0 border-b border-fallback text-fallback">
            {variant === "shuffled" ? "layout shuffled" : "labels renamed"}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className={`size-[7px] ${running ? "rx-pulse bg-reflex" : status === "done" ? "bg-reflex" : status === "error" ? "bg-danger" : "bg-faint"}`}
          />
          <span className="font-sans text-graphite">{statusText}</span>
          <span className="tnum w-[52px] text-right font-medium text-ink">
            {elapsedMs != null ? `${(elapsedMs / 1000).toFixed(1)} s` : "–"}
          </span>
        </span>
      </div>
      <div ref={containerRef} className="rx-scroll relative min-h-0 flex-1 overflow-auto bg-white">
        {children}
      </div>
    </section>
  );
}
