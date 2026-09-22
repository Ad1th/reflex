# Demo video script

The draft video `out/video/reflex-demo.mp4` (2:22) uses macOS TTS. To re-voice it, record these lines at the timestamps below, or re-run `pnpm exec tsx scripts/record.ts` after regenerating the clips. Run 1's length depends on Groq latency, so the timestamps shift a little.

**0:01** (intro)  
This is Reflex: AI agents that get faster every time they do something twice. Browser agents call an LLM for every single click, and the fiftieth time they do a task, they're exactly as slow as the first. Reflex gives them muscle memory, built on Moss.

**0:17** (run1 start)  
Run one. The agent has never seen this booking app. Every step is an LLM call, around a second each.

**0:42** (run1 end)  
Eleven LLM calls. But every step it took is now stored as a reflex in Moss: the page state, the action, and where it should land.

**0:50** (run2 start)  
Now a different person, on a different day and time. Before every step, the agent asks Moss: have I been exactly here before? That lookup takes about a millisecond.

**1:03** (run2 end)  
Ten out of ten steps replayed as reflexes, with no LLM calls. The only model call left is reading the instruction.

**1:11** (run3 start)  
Different wording, and a different meeting type. Names, days and times are abstracted into slots, so the reflexes still transfer.

**1:20** (run4 start)  
Now some chaos. The whole layout is shuffled. Reflexes target elements by role and label, not position, so they still fire.

**1:30** (run5 start)  
Harder chaos: the labels are renamed. The remembered buttons no longer exist, so those reflexes are rejected before acting, and the LLM takes over for just those steps.

**1:43** (run5 end)  
Nothing broke. Amber marks a reflex that was safely rejected, and the new steps were learned on the spot.

**1:50** (run6 start)  
Run it again, and it has already relearned. All reflexes.

**1:57** (moss)  
Why Moss? This lookup sits on the hot path of every single step, so it has to cost less than a click. Moss's in-process index answers in under a millisecond across twenty thousand reflexes, about twelve times faster than a brute force scan, and new reflexes are searchable instantly. Reflex: agents that stop thinking about things they've already figured out.
