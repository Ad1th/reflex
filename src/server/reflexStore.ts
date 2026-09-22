// Reflex library: Moss local session (custom 384-d embeddings) + JSON persistence of live reflexes.
import fs from "node:fs";
import path from "node:path";
import { MossClient, type SessionIndex } from "@moss-dev/moss";
import type { FeedbackRequest, LearnRequest, LookupRequest, LookupResponse, Reflex } from "../lib/types";
import { DIM, embed, warm } from "./embedder";

const SESSION_NAME = "reflex-lib";
const DATA_DIR = path.join(process.cwd(), "data");
const LIVE_FILE = path.join(DATA_DIR, "reflexes.json");
const SYN_META = path.join(DATA_DIR, "synthetic.meta.json");
const SYN_F32 = path.join(DATA_DIR, "synthetic.f32");
export const DEDUPE_COSINE = 0.985;
const ADD_CHUNK = 2000;

type Stored = Reflex & { embedding: Float32Array };

interface State {
  client: MossClient;
  session: SessionIndex;
  map: Map<string, Stored>;
  /** Moss metadata filter verified to work (else JS-side filtering over a wider topK). */
  filterOk: boolean;
  saveTimer?: NodeJS.Timeout;
  initMs: number;
}

const g = globalThis as unknown as { __reflexStore?: Promise<State> };

const toDoc = (r: Stored) => ({
  id: r.id,
  text: r.preKey,
  metadata: { flow: r.flow, source: r.source },
  embedding: Array.from(r.embedding),
});

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s;
}

async function addToSession(session: SessionIndex, items: Stored[]) {
  for (let i = 0; i < items.length; i += ADD_CHUNK) await session.addDocs(items.slice(i, i + ADD_CHUNK).map(toDoc));
}

async function create(): Promise<State> {
  const t0 = performance.now();
  const pid = process.env.MOSS_PROJECT_ID;
  const key = process.env.MOSS_PROJECT_KEY;
  if (!pid || !key) throw new Error("MOSS_PROJECT_ID / MOSS_PROJECT_KEY not set");
  const client = new MossClient(pid, key);
  const [session] = await Promise.all([client.session(SESSION_NAME, "custom"), warm()]);
  const map = new Map<string, Stored>();

  // Synthetic library (other fictional flows), if seeded.
  if (fs.existsSync(SYN_META) && fs.existsSync(SYN_F32)) {
    const meta: Reflex[] = JSON.parse(fs.readFileSync(SYN_META, "utf8"));
    const buf = fs.readFileSync(SYN_F32);
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    if (all.length === meta.length * DIM) {
      meta.forEach((r, i) => map.set(r.id, { ...r, source: "synthetic", embedding: all.subarray(i * DIM, (i + 1) * DIM) }));
    } else {
      console.warn(`[reflexStore] synthetic.f32 size mismatch (${all.length} vs ${meta.length * DIM}); skipping synthetic`);
    }
  }
  // Live reflexes persisted from previous runs.
  if (fs.existsSync(LIVE_FILE)) {
    try {
      const live: (Reflex & { embedding: number[] })[] = JSON.parse(fs.readFileSync(LIVE_FILE, "utf8"));
      for (const r of live) map.set(r.id, { ...r, source: "live", embedding: Float32Array.from(r.embedding) });
    } catch (e) {
      console.warn("[reflexStore] could not read reflexes.json:", e);
    }
  }
  await addToSession(session, [...map.values()]);
  const st: State = { client, session, map, filterOk: true, initMs: performance.now() - t0 };
  console.log(`[reflexStore] init ${map.size} docs in ${st.initMs.toFixed(0)} ms`);
  return st;
}

export function getStore(): Promise<State> {
  if (!g.__reflexStore) {
    g.__reflexStore = create().catch((e) => {
      g.__reflexStore = undefined;
      throw e;
    });
  }
  return g.__reflexStore;
}

export const init = getStore;

function scheduleSave(st: State) {
  if (st.saveTimer) clearTimeout(st.saveTimer);
  st.saveTimer = setTimeout(() => saveNow(st), 300);
}

function saveNow(st: State) {
  st.saveTimer = undefined;
  const live = [...st.map.values()].filter((r) => r.source === "live").map((r) => ({ ...r, embedding: Array.from(r.embedding) }));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = LIVE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(live));
  fs.renameSync(tmp, LIVE_FILE);
}

/** Flush pending writes (used by scripts before exit). */
export async function flush() {
  const st = await getStore();
  if (st.saveTimer) {
    clearTimeout(st.saveTimer);
    saveNow(st);
  }
}

const publicReflex = (r: Stored): Reflex => {
  const { embedding: _e, ...rest } = r;
  return rest;
};

async function queryFlow(st: State, vec: number[], flow: string, topK: number) {
  if (st.filterOk) {
    const res = await st.session.query("q", { topK, alpha: 1, embedding: vec, filter: { field: "flow", condition: { $eq: flow } } });
    // Guard: if the filter ever leaks other flows, switch permanently to JS-side filtering.
    if (res.docs.every((d) => st.map.get(d.id)?.flow === flow)) return res.docs;
    console.warn("[reflexStore] Moss filter returned other flows; falling back to JS filtering");
    st.filterOk = false;
  }
  const res = await st.session.query("q", { topK: 20, alpha: 1, embedding: vec });
  return res.docs.filter((d) => st.map.get(d.id)?.flow === flow).slice(0, topK);
}

export async function lookup(req: LookupRequest, threshold = 0.9): Promise<LookupResponse> {
  const t0 = performance.now();
  const st = await getStore();
  const { vec, ms: embedMs } = await embed(req.stateKey);
  const t1 = performance.now();
  const docs = await queryFlow(st, vec, req.flow, 3);
  const mossMs = performance.now() - t1;
  const candidates = docs.map((d) => ({ id: d.id, score: d.score }));
  const best = docs[0];
  const bestReflex = best ? st.map.get(best.id) : undefined;
  const match = best && bestReflex && best.score >= threshold ? { reflex: publicReflex(bestReflex), score: best.score } : null;
  return {
    match,
    candidates,
    timings: { embedMs, mossMs, totalMs: performance.now() - t0 },
    librarySize: st.session.docCount,
  };
}

export async function learn(req: LearnRequest): Promise<Reflex> {
  const st = await getStore();
  const { vec } = await embed(req.stateKey);
  const emb = Float32Array.from(vec);
  // Near-duplicate of an existing reflex in the same flow → overwrite it.
  let dup: Stored | undefined;
  let dupScore = -1;
  for (const r of st.map.values()) {
    if (r.flow !== req.flow) continue;
    const c = dot(r.embedding, emb);
    if (c > dupScore) {
      dupScore = c;
      dup = r;
    }
  }
  let r: Stored;
  if (dup && dupScore >= DEDUPE_COSINE) {
    r = { ...dup, preKey: req.stateKey, embedding: emb, action: req.action, postSignature: req.postSignature, misses: 0, source: "live" };
  } else {
    r = {
      id: crypto.randomUUID(),
      flow: req.flow,
      preKey: req.stateKey,
      action: req.action,
      postSignature: req.postSignature,
      hits: 0,
      misses: 0,
      createdAt: Date.now(),
      source: "live",
      embedding: emb,
    };
  }
  st.map.set(r.id, r);
  await st.session.addDocs([toDoc(r)], { upsert: true });
  scheduleSave(st);
  return publicReflex(r);
}

export async function feedback(req: FeedbackRequest): Promise<{ removed: boolean; reflex: Reflex | null }> {
  const st = await getStore();
  const r = st.map.get(req.reflexId);
  if (!r) return { removed: false, reflex: null };
  if (req.ok) r.hits++;
  else r.misses++;
  let removed = false;
  if (r.misses >= 2 && r.misses > r.hits) {
    await st.session.deleteDocs([r.id]);
    st.map.delete(r.id);
    removed = true;
  }
  if (r.source === "live") scheduleSave(st);
  return { removed, reflex: publicReflex(r) };
}

export async function stats() {
  const st = await getStore();
  let live = 0;
  let synthetic = 0;
  const byFlow: Record<string, number> = {};
  for (const r of st.map.values()) {
    if (r.source === "live") {
      live++;
      byFlow[r.flow] = (byFlow[r.flow] ?? 0) + 1;
    } else synthetic++;
  }
  // byFlow lists live flows individually; synthetic flows are summarised to keep the payload small.
  const syntheticFlows = new Set([...st.map.values()].filter((r) => r.source === "synthetic").map((r) => r.flow)).size;
  return { librarySize: st.session.docCount, live, synthetic, syntheticFlows, byFlow, initMs: Math.round(st.initMs), mossFilter: st.filterOk };
}

export async function listLive(): Promise<Reflex[]> {
  const st = await getStore();
  return [...st.map.values()].filter((r) => r.source === "live").map(publicReflex);
}

export async function resetLive(): Promise<{ removed: number }> {
  const st = await getStore();
  const ids = [...st.map.values()].filter((r) => r.source === "live").map((r) => r.id);
  if (ids.length) await st.session.deleteDocs(ids);
  for (const id of ids) st.map.delete(id);
  if (st.saveTimer) clearTimeout(st.saveTimer);
  saveNow(st);
  return { removed: ids.length };
}

function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export async function bench(n = 200) {
  const st = await getStore();
  const all = [...st.map.values()];
  const N = all.length;
  if (!N) return { librarySize: 0, n: 0, moss: { p50: 0, p99: 0 }, brute: { p50: 0, p99: 0 } };
  const mat = new Float32Array(N * DIM);
  all.forEach((r, i) => mat.set(r.embedding, i * DIM));
  const qs = Array.from({ length: n }, () => all[Math.floor(Math.random() * N)].embedding);
  const qArr = qs.map((q) => Array.from(q));

  const mossT: number[] = [];
  for (const q of qArr) {
    const t = performance.now();
    await st.session.query("q", { topK: 3, alpha: 1, embedding: q });
    mossT.push(performance.now() - t);
  }
  const bruteT: number[] = [];
  let sink = 0;
  for (const q of qs) {
    const t = performance.now();
    let s1 = -2, s2 = -2, s3 = -2, i1 = -1;
    for (let i = 0; i < N; i++) {
      const o = i * DIM;
      let s = 0;
      for (let j = 0; j < DIM; j++) s += q[j] * mat[o + j];
      if (s > s3) {
        if (s > s1) { s3 = s2; s2 = s1; s1 = s; i1 = i; }
        else if (s > s2) { s3 = s2; s2 = s; }
        else s3 = s;
      }
    }
    bruteT.push(performance.now() - t);
    sink += i1;
  }
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return {
    librarySize: st.session.docCount,
    n,
    moss: { p50: r(pct(mossT, 50)), p99: r(pct(mossT, 99)) },
    brute: { p50: r(pct(bruteT, 50)), p99: r(pct(bruteT, 99)) },
    _sink: sink > -1 ? undefined : sink,
  };
}
