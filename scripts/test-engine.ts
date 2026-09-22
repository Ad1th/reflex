// Engine smoke test: pnpm exec tsx --env-file=.env.local scripts/test-engine.ts
import assert from "node:assert/strict";
import type { PageState, Slots } from "../src/lib/types";
import { describeAction, fillAction, signature, stateKey, templatizeAction } from "../src/lib/templating";
import { embed, warm } from "../src/server/embedder";
import { bench, feedback, flush, learn, lookup, stats, getStore } from "../src/server/reflexStore";
import { parse, step } from "../src/server/groq";

const ms = (x: number) => `${x.toFixed(2)} ms`;
const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

const slots: Slots = { type: "Demo call", name: "Priya Sharma", email: "priya@acme.com", day: "Thursday", time: "3:00 PM", team_size: "11-50", notes: "" };

const detailsPage = (name = "", email = ""): PageState => ({
  route: "/book/details",
  heading: "Your details",
  elements: [
    { id: "e1", role: "link", label: "Home" },
    { id: "e2", role: "textbox", label: "Full name", value: name },
    { id: "e3", role: "textbox", label: "Work email", value: email },
    { id: "e4", role: "select", label: "Team size", value: "", options: ["1-10", "11-50", "51-200", "200+"] },
    { id: "e5", role: "textarea", label: "Notes", value: "" },
    { id: "e6", role: "checkbox", label: "I agree to the terms", value: "unchecked" },
    { id: "e7", role: "button", label: "Back" },
    { id: "e8", role: "button", label: "Confirm booking" },
  ],
});

async function main() {
  // 1. Embedder
  let t = performance.now();
  await warm();
  console.log(`embedder warm (incl. model load): ${ms(performance.now() - t)}`);
  const flow = "engine_test(day,email,name,notes,team_size,time,type)";
  const kEmpty = stateKey(flow, detailsPage(), slots);
  const kName = stateKey(flow, detailsPage("Priya Sharma"), slots);
  const kBoth = stateKey(flow, detailsPage("Priya Sharma", "priya@acme.com"), slots);
  const times: number[] = [];
  let vEmpty: number[] = [];
  for (let i = 0; i < 20; i++) {
    const r = await embed(kEmpty);
    times.push(r.ms);
    vEmpty = r.vec;
  }
  times.sort((a, b) => a - b);
  assert.equal(vEmpty.length, 384);
  assert.ok(Math.abs(cos(vEmpty, vEmpty) - 1) < 1e-4, "normalized");
  console.log(`embed stateKey (${kEmpty.length} chars): p50 ${ms(times[10])}, max ${ms(times[19])}`);
  const vName = (await embed(kName)).vec;
  const vBoth = (await embed(kBoth)).vec;
  console.log(`cosine empty vs name-filled: ${cos(vEmpty, vName).toFixed(4)}; name vs name+email: ${cos(vName, vBoth).toFixed(4)}; empty vs both: ${cos(vEmpty, vBoth).toFixed(4)}`);

  // 2. Store
  t = performance.now();
  await getStore();
  console.log(`store init: ${ms(performance.now() - t)}`);
  console.log("stats:", JSON.stringify(await stats()));

  const aName = templatizeAction({ kind: "type", role: "textbox", label: "Full name", text: "Priya Sharma" }, slots);
  const aEmail = templatizeAction({ kind: "type", role: "textbox", label: "Work email", text: "priya@acme.com" }, slots);
  const post = signature(detailsPage(), slots);
  const r1 = await learn({ flow, stateKey: kEmpty, action: aName, postSignature: post });
  const r2 = await learn({ flow, stateKey: kName, action: aEmail, postSignature: post });
  const deduped = r2.id === r1.id;
  console.log(`learned r1=${r1.id.slice(0, 8)} r2=${r2.id.slice(0, 8)} ${deduped ? "(r2 DEDUPED onto r1!)" : "(distinct)"}`);
  assert.deepEqual(aName, { kind: "type", role: "textbox", label: "Full name", text: "{name}" });

  // Same state with a different person → same templated key → exact match.
  const other: Slots = { ...slots, name: "Tom Lee", email: "tom@x.io", day: "Monday" };
  const kOther = stateKey(flow, detailsPage(), other);
  assert.equal(kOther, kEmpty);
  const lk = await lookup({ flow, stateKey: kOther });
  console.log(`lookup: score ${lk.match?.score.toFixed(4)} embed ${ms(lk.timings.embedMs)} moss ${ms(lk.timings.mossMs)} total ${ms(lk.timings.totalMs)} lib ${lk.librarySize}`);
  assert.ok(lk.match, "expected match");
  assert.equal(lk.match.reflex.id, r1.id);
  console.log(`  replay action: ${describeAction(fillAction(lk.match.reflex.action, other))}`);
  const lk2 = await lookup({ flow, stateKey: stateKey(flow, detailsPage("Tom Lee"), other) });
  console.log(`lookup name-filled: best ${lk2.match?.reflex.id.slice(0, 8)} score ${lk2.match?.score.toFixed(4)} candidates ${JSON.stringify(lk2.candidates.map((c) => c.score.toFixed(4)))}`);
  if (!deduped) assert.equal(lk2.match?.reflex.id, r2.id);

  // Filter: a flow with no reflexes must not match anything (the synthetic library has other flows).
  const lk3 = await lookup({ flow: "nonexistent_flow()", stateKey: kEmpty });
  assert.equal(lk3.match, null);
  assert.equal(lk3.candidates.length, 0);
  // And a synthetic flow's own query must only return its own flow.
  const st = await getStore();
  const syn = [...st.map.values()].find((r) => r.source === "synthetic");
  if (syn) {
    const lk4 = await lookup({ flow: syn.flow, stateKey: syn.preKey });
    assert.ok(lk4.candidates.every((c) => st.map.get(c.id)?.flow === syn.flow));
    console.log(`synthetic self-lookup: score ${lk4.match?.score.toFixed(4)} moss ${ms(lk4.timings.mossMs)} (filterOk=${st.filterOk})`);
  }

  // Warm lookup timings
  const lts: number[] = [];
  const mts: number[] = [];
  for (let i = 0; i < 30; i++) {
    const r = await lookup({ flow, stateKey: kOther });
    lts.push(r.timings.totalMs);
    mts.push(r.timings.mossMs);
  }
  lts.sort((a, b) => a - b);
  mts.sort((a, b) => a - b);
  console.log(`lookup x30: total p50 ${ms(lts[15])} max ${ms(lts[29])}; moss p50 ${ms(mts[15])} max ${ms(mts[29])}`);

  // Relearn identical state → overwrite, not add.
  const size0 = (await stats()).librarySize;
  const r1b = await learn({ flow, stateKey: kEmpty, action: aName, postSignature: post });
  assert.equal(r1b.id, r1.id);
  assert.equal((await stats()).librarySize, size0);

  // Feedback → removal after 2 misses.
  for (const r of deduped ? [r1] : [r1, r2]) {
    await feedback({ reflexId: r.id, ok: false });
    const f = await feedback({ reflexId: r.id, ok: false });
    assert.ok(f.removed, "removed after 2 misses");
  }
  assert.equal((await lookup({ flow, stateKey: kEmpty })).match, null);
  await flush();

  // Bench
  const b = await bench(200);
  console.log("bench:", JSON.stringify(b));

  // 3. Groq
  const p = await parse("Book a product demo for Priya Sharma (priya@acme.com) next Thursday at 3pm, we're a team of 30.");
  console.log("parse:", JSON.stringify(p));
  assert.equal(p.slots.name, "Priya Sharma");
  assert.equal(p.slots.day, "Thursday");
  assert.equal(p.slots.type, "Demo call");
  assert.equal(p.slots.team_size, "11-50");
  assert.equal(p.flowTemplate, "book_meeting(day,email,name,notes,team_size,time,type)");

  const s = await step({ goal: "Book a Demo call for Priya Sharma", slots: p.slots, page: detailsPage("Priya Sharma"), history: ['type "Priya Sharma" into textbox "Full name"'] });
  console.log(`step: ${describeAction(s.action)} (${s.ms} ms)`);
  assert.equal(s.action.kind, "type");
  if (s.action.kind === "type") assert.equal(s.action.label, "Work email");

  console.log("\nALL ENGINE TESTS PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
