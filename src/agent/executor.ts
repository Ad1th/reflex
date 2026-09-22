import type { Action } from "@/lib/types";
import { describeAction } from "@/lib/templating";
import { norm, snapshotWithElements } from "./snapshot";

const same = (a: string, b: string) => norm(a).toLowerCase() === norm(b).toLowerCase();

/** Find the unique visible element matching action.role + action.label (case-insensitive). Null if 0 or >1 matches. */
export function resolve(root: HTMLElement, action: Action): HTMLElement | null {
  if (action.kind === "done") return null;
  const { entries } = snapshotWithElements(root);
  let hits = entries.filter((e) => e.element.role === action.role && same(e.element.label, action.label));
  // Tie-break: if ambiguous, prefer enabled elements.
  if (hits.length > 1) hits = hits.filter((e) => !e.element.disabled);
  return hits.length === 1 ? hits[0].el : null;
}

/** Temporary overlay outline + badge around el. Returns a remover. Pure DOM, lives on document.body. */
export function highlight(el: HTMLElement, text: string, color = "#7c3aed"): () => void {
  const doc = el.ownerDocument;
  const r = el.getBoundingClientRect();
  const box = doc.createElement("div");
  box.setAttribute("data-rx-overlay", "");
  Object.assign(box.style, {
    position: "fixed", left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px`,
    border: `2px solid ${color}`, borderRadius: "6px", boxShadow: `0 0 0 4px ${color}33`, pointerEvents: "none",
    zIndex: "2147483646", transition: "opacity 150ms", boxSizing: "border-box",
  } as Partial<CSSStyleDeclaration>);
  const badge = doc.createElement("div");
  badge.textContent = text;
  Object.assign(badge.style, {
    position: "absolute", left: "-2px", bottom: "100%", marginBottom: "2px", background: color, color: "#fff",
    font: "600 11px/1.4 ui-sans-serif, system-ui, sans-serif", padding: "1px 6px", borderRadius: "4px",
    whiteSpace: "nowrap", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis",
  } as Partial<CSSStyleDeclaration>);
  box.appendChild(badge);
  doc.body.appendChild(box);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    box.style.opacity = "0";
    setTimeout(() => box.remove(), 160);
  };
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

export class ExecError extends Error {}

/**
 * Perform the action on el. By default shows a brief highlight (removed shortly after).
 * Pass { highlight: false } when the caller already highlighted (e.g. during the visual delay).
 */
export async function execute(el: HTMLElement, action: Action, opts: { highlight?: boolean } = {}): Promise<void> {
  const unhl = opts.highlight === false ? null : highlight(el, describeAction(action));
  try {
    switch (action.kind) {
      case "click":
        el.click();
        break;
      case "type": {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) throw new ExecError("type target is not a text field");
        el.focus();
        setNativeValue(el, action.text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
      case "select": {
        if (!(el instanceof HTMLSelectElement)) throw new ExecError("select target is not a <select>");
        const opt = Array.from(el.options).find((o) => same(o.text, action.option))
          ?? Array.from(el.options).find((o) => same(o.value, action.option));
        if (!opt) throw new ExecError(`option "${action.option}" not found`);
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
        if (setter) setter.call(el, opt.value); else el.value = opt.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
      case "check": {
        if (!(el instanceof HTMLInputElement)) throw new ExecError("check target is not a checkbox");
        if (el.checked !== action.checked) el.click();
        break;
      }
      case "done":
        break;
    }
  } finally {
    if (unhl) setTimeout(unhl, 350);
  }
}

const raf = () => new Promise<void>((res) => {
  // rAF is paused in background tabs; don't hang forever.
  const t = setTimeout(res, 100);
  requestAnimationFrame(() => { clearTimeout(t); res(); });
});

/** Let React flush/re-render: two animation frames + a microtask. */
export async function settle(): Promise<void> {
  await raf();
  await raf();
  await Promise.resolve();
}
