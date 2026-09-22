"use client";
// Test harness: mounts the target app + agent loop without the mission-control UI.
// Playwright (scripts/e2e.ts) drives it through window.__reflex.
import { useEffect, useRef, useState } from "react";
import { SlotlyApp, type SlotlyVariant } from "@/target/SlotlyApp";
import { runTask } from "@/agent/loop";

declare global {
  interface Window {
    __reflex?: {
      run: (instruction: string, variant: SlotlyVariant, threshold?: number) => Promise<unknown>;
    };
  }
}

export default function Harness() {
  const box = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<SlotlyVariant>("normal");
  const [mount, setMount] = useState(0);

  useEffect(() => {
    window.__reflex = {
      run: async (instruction, v, threshold) => {
        setVariant(v);
        setMount((m) => m + 1);
        // let React remount the target app
        await new Promise((r) => setTimeout(r, 100));
        return runTask({
          instruction,
          threshold,
          visualDelayMs: 0,
          getRoot: () => box.current!.querySelector("[data-rx-root]") as HTMLElement,
        });
      },
    };
  }, []);

  return (
    <div ref={box} style={{ width: 720, height: 640 }}>
      <SlotlyApp key={mount} variant={variant} />
    </div>
  );
}
