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
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-rule bg-panel shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-rule bg-panel-2 px-4">
        <div className="flex gap-2" aria-hidden>
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md bg-night px-3 font-mono text-[12px]">
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden className="shrink-0">
            <rect x="1" y="5" width="8" height="6.5" rx="1" fill="var(--faint)" />
            <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="var(--faint)" strokeWidth="1.3" />
          </svg>
          <span className="text-ink">slotly.app</span>
          <span className="truncate text-muted">{route === "/" ? "" : route}</span>
          {variant !== "normal" && (
            <span className="ml-auto shrink-0 rounded bg-fallback-dim px-1.5 py-0.5 font-sans text-[11px] text-fallback">
              {variant === "shuffled" ? "Layout shuffled" : "Labels renamed"}
            </span>
          )}
        </div>
        <div className="flex w-[196px] shrink-0 items-center justify-end gap-2 text-[12px]">
          {phase && (
            <>
              <span
                className={`size-1.5 rounded-full ${
                  running ? "rx-pulse bg-reflex" : status === "done" ? "bg-reflex" : "bg-faint"
                }`}
              />
              <span className="text-muted">
                {status === "stopped" ? "Stopped" : status === "error" ? "Failed" : PHASE_TEXT[phase]}
              </span>
              {elapsedMs != null && (
                <span className="tnum w-[46px] text-right font-semibold text-ink">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div ref={containerRef} className="rx-scroll relative min-h-0 flex-1 overflow-auto bg-white">
        {children}
      </div>
    </section>
  );
}
