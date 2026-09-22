// Slot templating + state keys. Shared by the browser agent loop and the server engine.
import type { Action, PageState, Slots } from "./types";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace every occurrence of a slot value with "{key}". Longest values first so "Priya Sharma" wins over "Priya". */
export function templatize(text: string, slots: Slots): string {
  let out = text;
  const entries = Object.entries(slots).filter(([, v]) => v && v.trim().length > 0).sort((a, b) => b[1].length - a[1].length);
  for (const [k, v] of entries) out = out.replace(new RegExp(esc(v.trim()), "gi"), `{${k}}`);
  return out;
}

/** Inverse of templatize: "{name}" -> slots.name. Unknown placeholders are left as-is. */
export function fill(text: string, slots: Slots): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in slots ? slots[k] : m));
}

export function templatizeAction(a: Action, slots: Slots): Action {
  switch (a.kind) {
    case "click": return { ...a, label: templatize(a.label, slots) };
    case "type": return { ...a, label: templatize(a.label, slots), text: templatize(a.text, slots) };
    case "select": return { ...a, label: templatize(a.label, slots), option: templatize(a.option, slots) };
    case "check": return { ...a, label: templatize(a.label, slots) };
    case "done": return a;
  }
}

export function fillAction(a: Action, slots: Slots): Action {
  switch (a.kind) {
    case "click": return { ...a, label: fill(a.label, slots) };
    case "type": return { ...a, label: fill(a.label, slots), text: fill(a.text, slots) };
    case "select": return { ...a, label: fill(a.label, slots), option: fill(a.option, slots) };
    case "check": return { ...a, label: fill(a.label, slots) };
    case "done": return a;
  }
}

/** Task family key. Same intent + same slot names => same flow, regardless of phrasing or values. */
export function flowKey(intent: string, slots: Slots): string {
  return `${intent}(${Object.keys(slots).sort().join(",")})`;
}

/** Templated text embedding of "where am I and what is done so far". This is what Moss indexes. */
export function stateKey(flow: string, page: PageState, slots: Slots): string {
  const lines = page.elements.map((e) => {
    let v = "";
    if (e.role === "checkbox") v = ` [${e.value ?? "unchecked"}]`;
    else if (e.role === "textbox" || e.role === "textarea" || e.role === "select") {
      const t = templatize(e.value ?? "", slots).trim();
      v = t === "" ? " = (empty)" : /^\{\w+\}$/.test(t) ? ` = ${t}` : " = (filled)";
    }
    return `${e.role} "${templatize(e.label, slots)}"${v}${e.disabled ? " (disabled)" : ""}`;
  });
  return [`TASK ${flow}`, `ROUTE ${page.route}`, `HEADING ${templatize(page.heading, slots)}`, ...lines].join("\n");
}

/** Post-condition signature: where we expect to land. Deliberately coarse (route + heading) so reordering/cosmetic changes don't break it. */
export function signature(page: PageState, slots: Slots): string {
  return `${page.route}|${templatize(page.heading, slots)}`;
}

/** Human-readable action, for timeline + LLM history. */
export function describeAction(a: Action): string {
  switch (a.kind) {
    case "click": return `click ${a.role} "${a.label}"`;
    case "type": return `type "${a.text}" into ${a.role} "${a.label}"`;
    case "select": return `select "${a.option}" in "${a.label}"`;
    case "check": return `${a.checked ? "check" : "uncheck"} "${a.label}"`;
    case "done": return `done${a.summary ? `: ${a.summary}` : ""}`;
  }
}
