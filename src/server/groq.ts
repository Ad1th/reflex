// Groq client: instruction parsing (JSON mode) and single-step tool calling.
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Groq JSON responses */
import type { Action, LlmStepRequest, LlmStepResponse, PageState, ParseResponse, Slots } from "../lib/types";
import { flowKey } from "../lib/templating";

export const GROQ_MODEL = "openai/gpt-oss-120b";
const URL = "https://api.groq.com/openai/v1/chat/completions";

const BOOK_KEYS = ["type", "name", "email", "day", "time", "team_size", "notes"] as const;

// Each Groq model has its own 8k tokens/min budget on the free tier, so on a 429 we rotate
// to the next model instead of stalling; if every model is limited we wait out the hint.
const FALLBACK_MODELS = [GROQ_MODEL, "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
const limitedUntil = new Map<string, number>();

async function groq(body: Record<string, unknown>): Promise<any> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  for (let attempt = 0; attempt < 6; attempt++) {
    const now = Date.now();
    const model = FALLBACK_MODELS.find((m) => (limitedUntil.get(m) ?? 0) <= now);
    if (!model) {
      const soonest = Math.min(...FALLBACK_MODELS.map((m) => limitedUntil.get(m) ?? 0));
      await new Promise((r) => setTimeout(r, Math.max(250, soonest - now)));
      continue;
    }
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, ...body }),
    });
    const text = await res.text();
    if (res.status === 429) {
      const hint = /try again in ([\d.]+)(ms|s)/.exec(text);
      const waitMs = hint ? parseFloat(hint[1]) * (hint[2] === "s" ? 1000 : 1) : 5000;
      limitedUntil.set(model, Date.now() + waitMs + 250);
      continue;
    }
    if (!res.ok) throw new Error(`Groq ${res.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text);
  }
  throw new Error("Groq: rate limited on all models");
}

const PARSE_SYSTEM = `You extract task parameters from a user instruction. Reply with a JSON object only: {"intent": string, "slots": {string: string}}.
Known intent "book_meeting" (booking/scheduling a call, demo, meeting, onboarding, support session). For book_meeting, slots MUST contain exactly these keys (use "" when absent):
- type: one of "Demo call", "Onboarding session", "Support call" (map synonyms: demo/product demo -> "Demo call"; onboarding/setup -> "Onboarding session"; support/help/issue -> "Support call")
- name: person's full name as given
- email: email address
- day: full English weekday with capital letter, e.g. "Thursday" (convert abbreviations like "thu")
- time: 12-hour format like "3:00 PM" or "10:30 AM"
- team_size: one of "1-10", "11-50", "51-200", "200+" (map a number to its bucket)
- notes: any extra notes/message for the meeting, else ""
For any other task use intent "other" and put whatever parameters you find into slots (snake_case keys, string values).`;

export async function parse(instruction: string): Promise<ParseResponse> {
  const t0 = performance.now();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await groq({
        messages: [
          { role: "system", content: PARSE_SYSTEM },
          { role: "user", content: instruction },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });
      const obj = JSON.parse(data.choices?.[0]?.message?.content ?? "");
      const intent = typeof obj.intent === "string" && obj.intent ? obj.intent : "other";
      const raw: Record<string, unknown> = obj.slots && typeof obj.slots === "object" ? obj.slots : {};
      const slots: Slots = {};
      if (intent === "book_meeting") {
        for (const k of BOOK_KEYS) slots[k] = raw[k] == null ? "" : String(raw[k]).trim();
      } else {
        for (const [k, v] of Object.entries(raw)) slots[k] = v == null ? "" : String(v).trim();
      }
      return { slots, flowTemplate: flowKey(intent, slots), ms: Math.round(performance.now() - t0), model: data.model ?? GROQ_MODEL };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "click",
      description: "Click a button, link or option.",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["button", "link", "option", "checkbox"] },
          label: { type: "string", description: "EXACT label from the element list" },
        },
        required: ["role", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type",
      description: "Replace the content of a text field with text.",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["textbox", "textarea"] },
          label: { type: "string", description: "EXACT label from the element list" },
          text: { type: "string" },
        },
        required: ["role", "label", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "select",
      description: "Choose an option in a select/dropdown.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "EXACT label of the select" },
          option: { type: "string", description: "EXACT option text" },
        },
        required: ["label", "option"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check",
      description: "Check or uncheck a checkbox.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "EXACT label of the checkbox" },
          checked: { type: "boolean" },
        },
        required: ["label", "checked"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "done",
      description: "The goal is fully achieved (e.g. the booking confirmation page is shown).",
      parameters: { type: "object", properties: { summary: { type: "string" } }, required: [] },
    },
  },
];

const STEP_SYSTEM = `You operate a web app one action at a time to achieve the user's goal. Each turn you get the current page (route, heading, interactive elements with their current values) and the history of actions already taken. Call exactly ONE tool.
Rules:
- Use the EXACT role and label from the element list (copy them verbatim). Never invent elements. Ignore disabled elements.
- Do not repeat completed actions: check the history and the current field values. A field that already shows the right value is done.
- Fill fields using the provided slot values verbatim. Leave optional fields whose slot value is empty alone.
- For selects, pick an option that appears in that select's options list.
- Proceed through the flow (e.g. choose options, then continue/submit buttons) until finished.
- Call done only when the goal is achieved (e.g. a booking confirmed page is shown).`;

function renderPage(p: PageState): string {
  const lines = p.elements.map((e) => {
    let s = `- ${e.role} "${e.label}"`;
    if (e.value !== undefined) s += ` value=${JSON.stringify(e.value)}`;
    if (e.options?.length) s += ` options=${JSON.stringify(e.options)}`;
    if (e.disabled) s += " (disabled)";
    return s;
  });
  return `ROUTE: ${p.route}\nHEADING: ${p.heading}\nELEMENTS:\n${lines.join("\n")}`;
}

const ROLES = new Set(["button", "link", "textbox", "textarea", "checkbox", "select", "option"]);

function toAction(name: string, args: any, page: PageState): Action {
  const str = (v: unknown, field: string) => {
    if (typeof v !== "string") throw new Error(`tool ${name}: missing ${field}`);
    return v;
  };
  const exists = (label: string) => page.elements.some((e) => e.label === label);
  switch (name) {
    case "click": {
      const label = str(args.label, "label");
      const el = page.elements.find((e) => e.label === label && e.role === args.role) ?? page.elements.find((e) => e.label === label);
      if (!el) throw new Error(`click: no element labelled "${label}"`);
      return { kind: "click", role: el.role, label };
    }
    case "type": {
      const label = str(args.label, "label");
      if (!exists(label)) throw new Error(`type: no element labelled "${label}"`);
      const el = page.elements.find((e) => e.label === label && (e.role === "textbox" || e.role === "textarea"));
      const role = el?.role === "textarea" ? "textarea" : args.role === "textarea" ? "textarea" : "textbox";
      return { kind: "type", role, label, text: typeof args.text === "string" ? args.text : String(args.text ?? "") };
    }
    case "select": {
      const label = str(args.label, "label");
      if (!exists(label)) throw new Error(`select: no element labelled "${label}"`);
      return { kind: "select", role: "select", label, option: str(args.option, "option") };
    }
    case "check": {
      const label = str(args.label, "label");
      if (!exists(label)) throw new Error(`check: no element labelled "${label}"`);
      const checked = typeof args.checked === "boolean" ? args.checked : args.checked !== "false";
      return { kind: "check", role: "checkbox", label, checked };
    }
    case "done":
      return { kind: "done", summary: typeof args.summary === "string" ? args.summary : undefined };
  }
  throw new Error(`unknown tool ${name}`);
}

export async function step(req: LlmStepRequest): Promise<LlmStepResponse> {
  const t0 = performance.now();
  const user = `GOAL: ${req.goal}
SLOTS: ${JSON.stringify(req.slots)}
HISTORY (actions already done, oldest first):
${req.history.length ? req.history.map((h, i) => `${i + 1}. ${h}`).join("\n") : "(none)"}

CURRENT PAGE:
${renderPage(req.page)}`;
  const messages: any[] = [
    { role: "system", content: STEP_SYSTEM },
    { role: "user", content: user },
  ];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await groq({ messages, tools: TOOLS, tool_choice: "required", temperature: 0 });
      const msg = data.choices?.[0]?.message;
      const call = msg?.tool_calls?.[0];
      if (!call) throw new Error("no tool call returned");
      const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      const action = toAction(call.function.name, args, req.page);
      if (action.kind === "click" && !ROLES.has(action.role)) throw new Error("bad role");
      return {
        action,
        reasoning: typeof msg.reasoning === "string" ? msg.reasoning.slice(0, 500) : undefined,
        ms: Math.round(performance.now() - t0),
        model: data.model ?? GROQ_MODEL,
      };
    } catch (e) {
      lastErr = e;
      messages.push({
        role: "user",
        content: `Your previous answer was invalid (${e instanceof Error ? e.message : String(e)}). Call exactly one tool using an EXACT label from the element list.`,
      });
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
