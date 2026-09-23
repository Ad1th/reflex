import { PRESETS, VARIANTS, type Variant } from "./model";

/** Text option: the active one is ink and underlined, the rest are quiet. */
function optionCls(on: boolean) {
  return `underline-offset-[5px] disabled:opacity-40 ${
    on ? "text-ink underline decoration-ink decoration-[1.5px]" : "text-muted hover:text-ink"
  }`;
}

function presetCls(on: boolean) {
  return `disabled:opacity-40 ${on ? "text-ink" : "text-muted hover:text-ink"}`;
}

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
    <section className="flex shrink-0 flex-col">
      <label htmlFor="rx-instruction" className="text-[13px] text-muted">
        Task
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
        className="mt-1.5 block w-full resize-none border-0 border-b border-rule bg-transparent px-0 pt-0 pb-3 text-[19px] leading-[1.42] tracking-[-0.005em] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
      />

      <div className="mt-3.5 flex items-center gap-5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setInstruction(p.text)}
              disabled={running}
              title={p.text}
              className={`whitespace-nowrap ${presetCls(instruction === p.text)}`}
            >
              <span className="tnum mr-1.5 font-mono text-[11.5px] text-faint">{p.key}</span>
              <span className={instruction === p.text ? optionCls(true) : undefined}>
                {p.who}, {p.what.toLowerCase()}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto shrink-0">
          {running ? (
            <button
              onClick={onStop}
              className="h-10 border border-ink px-6 text-[14px] font-medium text-ink hover:bg-ink hover:text-paper"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={onRun}
              disabled={!instruction.trim()}
              className="h-10 bg-ink px-6 text-[14px] font-medium text-paper hover:bg-graphite disabled:opacity-40"
            >
              Run agent
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-x-5 text-[13px] whitespace-nowrap">
        <fieldset className="flex items-baseline gap-2.5" disabled={running}>
          <legend className="float-left text-muted">Chaos</legend>
          {VARIANTS.map((v) => (
            <button
              key={v.value}
              onClick={() => setVariant(v.value)}
              aria-pressed={variant === v.value}
              className={optionCls(variant === v.value)}
            >
              {v.label}
            </button>
          ))}
        </fieldset>

        <button
          role="switch"
          aria-checked={turbo}
          onClick={() => setTurbo(!turbo)}
          title="Skip the 250 ms pause the demo adds between steps"
          className={optionCls(turbo)}
        >
          Turbo
        </button>

        <label className="ml-auto flex items-center gap-2.5 text-muted">
          <span>Threshold</span>
          <input
            type="range"
            className="rx-range w-12"
            min={0.8}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={running}
          />
          <span className="tnum font-mono text-[12.5px] text-ink">{threshold.toFixed(2)}</span>
        </label>
      </div>
    </section>
  );
}
