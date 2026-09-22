import { PRESETS, VARIANTS, type Variant } from "./model";

export function Controls({
  instruction,
  setInstruction,
  variant,
  setVariant,
  turbo,
  setTurbo,
  threshold,
  setThreshold,
  running,
  onRun,
  onStop,
}: {
  instruction: string;
  setInstruction: (s: string) => void;
  variant: Variant;
  setVariant: (v: Variant) => void;
  turbo: boolean;
  setTurbo: (b: boolean) => void;
  threshold: number;
  setThreshold: (n: number) => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="relative rounded-lg border border-rule bg-panel focus-within:border-muted">
        <label htmlFor="rx-instruction" className="sr-only">
          Task for the agent
        </label>
        <textarea
          id="rx-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running) onRun();
          }}
          rows={2}
          placeholder="Tell the agent what to book…"
          className="block w-full resize-none bg-transparent px-3.5 pt-3 pb-12 text-[15px] leading-[1.45] text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="absolute right-2.5 bottom-2.5 left-3.5 flex items-center gap-1.5">
          {PRESETS.map((p) => {
            const active = instruction === p.text;
            return (
              <button
                key={p.key}
                onClick={() => setInstruction(p.text)}
                disabled={running}
                title={p.text}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-40 ${
                  active
                    ? "border-ink/60 bg-ink/10 text-ink"
                    : "border-rule text-muted hover:border-muted hover:text-ink"
                }`}
              >
                <span className="font-semibold">{p.key}</span> {p.who}, {p.what.toLowerCase()}
              </button>
            );
          })}
          <div className="ml-auto">
            {running ? (
              <button
                onClick={onStop}
                className="flex h-8 items-center gap-2 rounded-md border border-danger/60 px-3.5 text-[13px] font-semibold text-danger hover:bg-danger/10"
              >
                <span className="size-2 rounded-[2px] bg-danger" /> Stop
              </button>
            ) : (
              <button
                onClick={onRun}
                disabled={!instruction.trim()}
                className="flex h-8 items-center gap-2 rounded-md bg-ink px-4 text-[13px] font-semibold text-night hover:bg-white disabled:opacity-40"
              >
                <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
                  <path d="M0 0L9 5L0 10Z" fill="currentColor" />
                </svg>
                Run agent
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        <fieldset className="flex items-center gap-2" disabled={running}>
          <legend className="float-left mr-1 text-muted">Chaos</legend>
          <div className="flex rounded-md border border-rule p-0.5">
            {VARIANTS.map((v) => (
              <button
                key={v.value}
                onClick={() => setVariant(v.value)}
                aria-pressed={variant === v.value}
                className={`rounded px-2 py-1 transition-colors disabled:opacity-50 ${
                  variant === v.value
                    ? v.value === "normal"
                      ? "bg-panel-2 text-ink"
                      : "bg-fallback-dim text-fallback"
                    : "text-muted hover:text-ink"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          role="switch"
          aria-checked={turbo}
          onClick={() => setTurbo(!turbo)}
          className="flex items-center gap-2 text-muted hover:text-ink"
        >
          <span
            className={`relative h-4 w-7 rounded-full transition-colors ${turbo ? "bg-reflex" : "bg-rule"}`}
          >
            <span
              className={`absolute top-0.5 size-3 rounded-full bg-night transition-[left] ${
                turbo ? "left-3.5" : "left-0.5"
              }`}
            />
          </span>
          <span className={turbo ? "text-ink" : undefined}>Turbo</span>
        </button>

        <label className="flex items-center gap-2 text-muted">
          <span>Threshold</span>
          <input
            type="range"
            className="rx-range w-20"
            min={0.8}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={running}
          />
          <span className="tnum w-8 font-semibold text-ink">{threshold.toFixed(2)}</span>
        </label>

      </div>
    </section>
  );
}
