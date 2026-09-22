# Reflex — build spec & progress

**Reflex: AI agents that get faster every time they do something twice.**
Hackathon: YC Fall 2026 x Moss (deadline 2026-09-23 12:00 IST). Runs on localhost (`pnpm dev` / `pnpm build && pnpm start`, port 3000). Hosting later — needs a long-running Node server (NOT Vercel serverless: the Moss session lives in process memory).

## Core idea
A computer-use style agent operates a web app step by step. Before every step it asks Moss "have I been in this exact situation before?" (~1 ms local query). On a confident, verified match it replays the remembered action **without calling the LLM**. Otherwise it calls the LLM (Groq), acts, and learns the step as a new reflex. Run 1 = all LLM (slow). Run 2 with different details = reflexes (fast). Layout changes → reflexes safely rejected per step → LLM fallback → relearned.

## Verified facts (Moss probe, 2026-09-23 ~02:40)
- `@moss-dev/moss` (Node) `client.session(name, "custom")` = local in-process index. With our own 384-d embeddings: 20k docs added in 1.3 s; query p50 0.66 ms, p99 5.75 ms; single addDocs ~65 ms.
- Query with our own vector: `session.query("x", { topK, alpha: 1, embedding: number[] })`. Use `alpha: 1` (embedding-only), else scores are scaled by 0.8.
- Built-in `moss-minilm` model download returns **401** for this project → we supply embeddings ourselves (`@huggingface/transformers`, `Xenova/all-MiniLM-L6-v2`, 384-d, normalized, mean pooling).
- Cloud ops are slow (createIndex ~34 s, addDocs ~9 s, loadIndex ~7-10 s) → only for background persistence (`session.pushIndex()`), never on the hot path.
- Metadata filters work: `filter: { field: "flow", condition: { $eq: flow } }`. Metadata values must be strings.
- `@moss-dev/moss-web` exists (browser WASM) but has no local session/addDocs → not used.
- Groq models available: `openai/gpt-oss-120b` (use this, tool calling), `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`. No llama-3.3.

## Architecture
```
Browser (Next.js page)
 ├─ Target app "Slotly" (mock booking site) rendered in a panel, root has data-route
 ├─ Agent loop (src/agent/*): snapshot DOM → stateKey → POST /api/reflex/lookup
 │     match & target resolvable → execute (⚡ reflex) → verify postSignature → POST /api/reflex/feedback
 │     else → POST /api/llm/step (🧠) → execute → POST /api/reflex/learn
 └─ Mission-control UI: timeline, badges, ms, counters, chaos toggle
Node server (route handlers, runtime "nodejs")
 ├─ src/server/embedder.ts  transformers.js MiniLM (singleton, warm on boot)
 ├─ src/server/reflexStore.ts  Moss session (custom embeddings) + JSON persistence data/reflexes.json
 ├─ src/server/groq.ts  parse instruction → slots; step → tool call
 └─ /api/reflex/{lookup,learn,feedback,stats,reset}, /api/llm/{parse,step}
```
Contracts: `src/lib/types.ts`, `src/lib/templating.ts` (owned by orchestrator — do not change signatures; add helpers in your own files).

## Lanes & file ownership
- **Lane A — target app**: `src/target/**` only. Exports `<SlotlyApp variant="normal"|"shuffled"|"renamed" onRouteChange? />`.
- **Lane B — server engine**: `src/server/**`, `src/app/api/**`.
- **Lane C — agent runtime**: `src/agent/**` (snapshot, executor, loop).
- **Lane D — UI**: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/ui/**`.
- Orchestrator: contracts, integration, e2e test (`scripts/e2e.ts` with Playwright), docs.

## Status log
- 02:40 Moss probe done, scaffold done, contracts written.
- 04:10 All lanes landed. Moss scores are rank-based (top hit = 1.0) → engine retrieves top-10 via Moss then rescores with exact cosine; plus exact formState gate (route + form-field states).
- 04:10 e2e (scripts/e2e.ts, harness page /harness) ALL PASS: run1 cold 11.5s/11 LLM calls → run2 1.8s/1 call (10/10 reflex); rephrased 1.3s; shuffled 0.9s; renamed 10.7s (3 reflex, LLM for renamed pages, 1 fallback target_missing) → renamed again 1.05s all reflex. Bench @20k: Moss p50 ~0.7-1.0ms vs brute-force JS p50 9.3ms.
- Groq free tier = 8k TPM per model → rotate gpt-oss-120b → gpt-oss-20b → qwen3.8-27b on 429.
- 04:15 Done & pushed to https://github.com/Ad1th/reflex (public). 3/3 e2e passes (18/18 runs). README, PRD (docs/PRD.md), architecture (docs/architecture.png), submission copy (docs/SUBMISSION.md), video script (docs/VIDEO_SCRIPT.md), narrated TTS draft video out/video/reflex-demo.mp4 (2:22, gitignored).
- Production server left running on localhost:3000 (`pnpm start`).

## Morning TODO (user)
1. Watch out/video/reflex-demo.mp4; re-voice with docs/VIDEO_SCRIPT.md if wanted (or submit as is).
2. Deploy: needs long-running Node (Render/Railway Docker from Dockerfile — untested build; or `pnpm build && pnpm start` on a VM). Vercel serverless will NOT work (in-memory Moss session).
3. Submit on HiDevs with docs/SUBMISSION.md text, architecture.png, PRD, repo, deployed link, video.
4. Rotate the Moss/Groq/Kaggle keys after the hackathon (they were pasted in chat).
