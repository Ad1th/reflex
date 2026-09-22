# Submission copy

**Name:** Reflex
**Tagline:** AI agents that get faster every time they do something twice.
**Theme:** Agent Reliability & Evaluation, plus Local-First AI

## What it does
Browser and computer-use agents call an LLM for every click, forever. Reflex gives them muscle memory. Before each step the agent asks Moss *"have I been in exactly this situation before?"* That query takes about 1 ms. If a remembered step matches and passes three safety gates (similarity, exact form state, target present on the live page), Reflex replays the action **without calling the LLM** and then verifies where it landed. Anything unfamiliar goes to the LLM for just that step, and the result is learned instantly.

Measured on our demo flow:
- **First run:** 11 LLM calls, 11–20 s.
- **Second run, different person/day/time:** 1 LLM call (parsing only), 10/10 steps from reflexes, about 1–2 s.
- **Shuffled layout:** still 100% reflex.
- **Renamed labels:** affected reflexes are rejected *before* acting, the LLM covers just those steps, and the next run is 100% reflex again.

## How Moss is used
- Every learned step is a document in a **Moss in-process session index**: a templated page state, embedded with MiniLM, with the action and expected post-state as the payload.
- Moss is queried on the hot path of **every agent step**: top-10 with a flow metadata filter, then exact rescoring.
- **p50 0.6–0.8 ms at 20,016 reflexes**, against 9.3–9.9 ms for a brute-force scan.
- New reflexes are searchable ~65 ms after they're learned, with no cloud round trip in the loop.
- The lookup has to cost less than a click, because it replaces an LLM call that costs seconds.

## Links
- GitHub: https://github.com/Ad1th/reflex
- Demo: <deployed URL>
- Video: <upload link>
- Architecture: docs/architecture.png · PRD: docs/PRD.md
