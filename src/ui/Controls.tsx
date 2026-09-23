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
    <section className="flex shrink-0 flex-col gap-2.5 pb-4">
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
        placeholder="Tell the agent what to book"
        className="block w-full resize-none rounded-[2px] border border-rule bg-sheet px-3 py-2 text-[14.5px] leading-[1.45] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
      />

      <div className="flex items-center gap-4">
        <div className="flex min-w-0 items-baseline gap-3.5 text-[12.5px]">
          {PRESETS.map((p) => {
            const active = instruction === p.text;
            return (
              <button
                key={p.key}
                onClick={() => setInstruction(p.text)}
                disabled={running}
                title={p.text}
                className={`whitespace-nowrap border-b pb-px disabled:opacity-40 ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:border-rule hover:text-ink"
                }`}
              >
                <span className="font-mono text-[11.5px] font-medium">{p.key}</span> {p.who}, {p.what.toLowerCase()}
              </button>
            );
          })}
        </div>
        <div className="ml-auto shrink-0">
          {running ? (
            <button
              onClick={onStop}
              className="flex h-8 items-center gap-2 rounded-[2px] border border-danger px-3.5 text-[13px] font-medium text-danger hover:bg-danger hover:text-white"
            >
              <span aria-hidden className="size-2 bg-current" /> Stop
            </button>
          ) : (
            <button
              onClick={onRun}
              disabled={!instruction.trim()}
              className="flex h-8 items-center gap-2 rounded-[2px] bg-ink px-4 text-[13px] font-medium text-paper hover:bg-graphite disabled:opacity-40"
            >
              Run agent
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule-soft pt-2.5 text-[12.5px]">
        <fieldset className="flex items-center gap-2.5" disabled={running}>
          <legend className="float-left text-muted">Chaos</legend>
          <div className="flex border border-rule">
            {VARIANTS.map((v, i) => {
              const on = variant === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setVariant(v.value)}
                  aria-pressed={on}
                  className={`px-2 py-[3px] disabled:opacity-50 ${i > 0 ? "border-l border-rule" : ""} ${
                    on
                      ? v.value === "normal"
                        ? "bg-ink text-paper"
                        : "bg-fallback text-white"
                      : "text-graphite hover:bg-wash"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          role="switch"
          aria-checked={turbo}
          onClick={() => setTurbo(!turbo)}
          className="flex items-center gap-2 text-muted hover:text-ink"
        >
          <span aria-hidden className="flex size-3.5 items-center justify-center border border-graphite">
            {turbo && <span className="size-2 bg-ink" />}
          </span>
          <span className={turbo ? "text-ink" : undefined}>Turbo</span>
        </button>

        <label className="flex items-center gap-2.5 text-muted">
          <span>Threshold</span>
          <input
            type="range"
            className="rx-range w-16"
            min={0.8}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={running}
          />
          <span className="tnum font-mono text-[12px] font-medium text-ink">{threshold.toFixed(2)}</span>
        </label>
      </div>
    </section>
  );
}
