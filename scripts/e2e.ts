// End-to-end: run the demo sequence against the harness page and print real timings.
// Usage: pnpm exec tsx scripts/e2e.ts [baseUrl]   (server must be running; resets live reflexes first)
import { chromium } from "playwright";
import type { RunSummary } from "../src/lib/types";

const base = process.argv[2] ?? "http://localhost:3000";

const seq: [string, "normal" | "shuffled" | "renamed", string][] = [
  ["run1 cold", "normal", "Book a Demo call for Priya Sharma (priya@acme.io) on Thursday at 3:00 PM, team size 11-50."],
  ["run2 warm", "normal", "Book a Demo call for Arjun Mehta (arjun@zeta.dev) on Friday at 10:00 AM, team size 51-200."],
  ["run3 rephrased", "normal", "Schedule an Onboarding session for Meera Nair, meera@orbit.in, Monday 2:00 PM, team of 1-10."],
  ["run4 shuffled", "shuffled", "Book a Support call for Kabir Rao (kabir@nimbus.co) on Tuesday at 9:00 AM, team size 200+."],
  ["run5 renamed", "renamed", "Book a Demo call for Ishaan Gupta (ishaan@lumen.ai) on Wednesday at 4:00 PM, team size 11-50."],
  ["run6 renamed again", "renamed", "Book a Demo call for Tara Iyer (tara@quanta.io) on Thursday at 11:00 AM, team size 1-10."],
];

async function main() {
  await fetch(`${base}/api/reflex/reset`, { method: "POST" });
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  page.on("console", (m) => m.type() === "error" && console.log("  [browser]", m.text()));
  await page.goto(`${base}/harness`);
  await page.waitForFunction(() => !!window.__reflex);

  for (const [label, variant, instruction] of seq) {
    const s = (await page.evaluate(
      ([i, v]) => window.__reflex!.run(i, v as "normal"),
      [instruction, variant] as const,
    )) as RunSummary;
    const steps = s.steps.map((e) => (e.source === "reflex" ? "⚡" : e.source === "llm" ? "🧠" : "↩")).join("");
    const done = await page.locator("h1").first().textContent();
    console.log(
      `${label.padEnd(20)} ok=${s.ok} wall=${(s.wallMs / 1000).toFixed(2)}s llmCalls=${s.llmCalls} reflex=${s.reflexHits} steps=${steps} final="${done}"${s.error ? " err=" + s.error : ""}`,
    );
    for (const e of s.steps.filter((e) => e.rejectReason)) console.log(`    reject step ${e.index}: ${e.rejectReason} score=${e.score?.toFixed(3)}`);
  }
  const bench = await (await fetch(`${base}/api/reflex/bench?n=200`)).json();
  console.log("bench", JSON.stringify(bench));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
