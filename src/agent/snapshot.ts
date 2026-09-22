import type { PageElement, PageState } from "@/lib/types";

export const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

const TEXT_TYPES = new Set(["", "text", "email", "search", "tel", "number", "password"]);
const SELECTOR = "button, a[href], input, textarea, select";

export function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return false;
  return true;
}

function roleOf(el: HTMLElement): PageElement["role"] | null {
  const tag = el.tagName;
  if (tag === "BUTTON") return "button";
  if (tag === "A") return "link";
  if (tag === "TEXTAREA") return "textarea";
  if (tag === "SELECT") return "select";
  if (tag === "INPUT") {
    const t = (el.getAttribute("type") ?? "").toLowerCase();
    if (t === "checkbox") return "checkbox";
    if (TEXT_TYPES.has(t)) return "textbox";
    if (t === "submit" || t === "button") return "button";
  }
  return null;
}

function labelOf(el: HTMLElement, role: PageElement["role"]): string {
  const aria = norm(el.getAttribute("aria-label"));
  if (aria) return aria;
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const t = norm(labelledby.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "").join(" "));
    if (t) return t;
  }
  if (el.id) {
    const lab = el.ownerDocument.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    const t = norm(lab?.innerText || lab?.textContent);
    if (t) return t;
  }
  const wrap = el.closest("label");
  if (wrap) {
    // Text of the wrapping label minus the control's own text (e.g. select options).
    const clone = wrap.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("select, textarea, option").forEach((n) => n.remove());
    const t = norm(clone.textContent);
    if (t) return t;
  }
  if (role === "button" || role === "link") {
    const t = norm(el.innerText || el.textContent);
    if (t) return t;
    if (el instanceof HTMLInputElement) { const v = norm(el.value); if (v) return v; }
  }
  const ph = norm(el.getAttribute("placeholder"));
  if (ph) return ph;
  return norm(el.getAttribute("title") ?? el.getAttribute("name"));
}

export interface SnapshotEntry { el: HTMLElement; element: PageElement; }

/** Snapshot with element handles (used by the executor). Assigns data-rx-id. */
export function snapshotWithElements(root: HTMLElement): { page: PageState; entries: SnapshotEntry[] } {
  const entries: SnapshotEntry[] = [];
  let n = 0;
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    const role = roleOf(el);
    if (!role || !isVisible(el)) { el.removeAttribute("data-rx-id"); return; }
    const id = `e${n++}`;
    el.setAttribute("data-rx-id", id);
    const pe: PageElement = { id, role, label: labelOf(el, role) };
    if (el instanceof HTMLInputElement && role === "checkbox") pe.value = el.checked ? "checked" : "unchecked";
    else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) pe.value = el.value;
    else if (el instanceof HTMLSelectElement) {
      const opt = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      pe.value = el.value !== "" && opt ? norm(opt.text) : "";
      pe.options = Array.from(el.options).filter((o) => o.value !== "").map((o) => norm(o.text));
    }
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") pe.disabled = true;
    entries.push({ el, element: pe });
  });
  const h = root.querySelector("h1") ?? root.querySelector("h2");
  const page: PageState = {
    route: root.dataset.route ?? "",
    heading: norm((h as HTMLElement | null)?.innerText || h?.textContent),
    elements: entries.map((e) => e.element),
  };
  return { page, entries };
}

export function snapshot(root: HTMLElement): PageState {
  return snapshotWithElements(root).page;
}
