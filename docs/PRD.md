# Reflex — Product Requirements Document

**One-liner:** AI agents that get faster every time they do something twice.

## 1. Problem
Computer-use and browser agents re-think every step from scratch. Each click costs one LLM round trip, typically 1–5 s, plus tokens. The 50th time an agent books a meeting, files an expense or updates a CRM record, it is exactly as slow and expensive as the first time.

Humans don't work this way. Repeated procedures turn into muscle memory, and we only think again when something unexpected happens.

Existing agent memory (workflow memory, plan caching, "lessons" files) feeds past experience **back into the prompt**, so the agent still pays full LLM latency on every step.

## 2. Solution
Reflex is a step-level reflex layer that sits between an agent and its LLM.

1. **Record.** Every step the agent takes is stored as *(templated page state → templated action → expected post-state)*. Task-specific values such as names, emails and dates are abstracted into slots like `{name}` and `{day}`, so a step learned for one input transfers to another.
2. **Reflex lookup.** Before each step, the current state is embedded and looked up in a **Moss** index running in-process. This takes about 1 ms.
3. **Gated replay.** A remembered action is executed **without calling the LLM** only if all of these hold:
   - similarity ≥ threshold;
   - the templated target resolves to exactly one element on the live page;
   - after acting, the page reaches the remembered post-state (route + heading).
4. **Per-step fallback.** When any gate fails, the LLM handles only that step, and the new behaviour is learned. Reflexes that keep failing are pruned.

## 3. Users & use cases
- Teams running browser or computer-use agents on repetitive SaaS workflows: scheduling, CRM hygiene, expense filing, ticket triage, QA regression flows.
- Agent platforms that want lower latency and cost without fine-tuning.

## 4. Requirements
| # | Requirement | Status |
|---|---|---|
| R1 | Agent completes a multi-step booking flow from a natural-language instruction | |
| R2 | A second run with different details completes with ≥80% of steps served by reflex | |
| R3 | Reflex lookup p50 ≤ 5 ms at a library size of ≥ 20k | |
| R4 | Shuffled layout (same labels, different order): reflexes still fire | |
| R5 | Renamed labels: affected steps are rejected before acting and fall back to the LLM; the next run is reflex again | |
| R6 | Every step is visible in the UI with its source (LLM / reflex / fallback) and timings | |
| R7 | Honest benchmark: Moss vs brute-force cosine at the current library size | |

## 5. Why Moss
- **Latency budget.** A reflex replaces an LLM call, so the lookup must cost roughly the same as a DOM action. That rules out a network round trip to a hosted vector DB on every step.
- **In-process session.** Moss `session()` indexes locally. New reflexes become queryable immediately (~65 ms add), and queries run in under 1 ms. Cloud sync (`pushIndex`) happens in the background.
- **Scale.** The library grows with every step of every run: a fleet memory of 20k+ reflexes, all queried on the hot path.

## 6. Non-goals (hackathon scope)
Real third-party sites, authentication, multi-tab tasks, and cross-user sharing of learned reflexes (architecture supports it via `pushIndex`; not demoed).

## 7. Metrics (measured, see README)
To be filled from `scripts/e2e.ts`.
