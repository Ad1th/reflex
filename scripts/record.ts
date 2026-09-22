// Records the narrated demo video: drives the real UI paced to TTS narration clips, then muxes audio.
// Prereq: out/narration/*.aiff + durations.json (generated from scripts/narration.json with macOS `say`).
// Usage: pnpm exec tsx scripts/record.ts [baseUrl]  → out/video/reflex-demo.mp4
import { chromium, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const dur: Record<string, number> = JSON.parse(readFileSync("out/narration/durations.json", "utf8"));
const out = "out/video";
const cues: { clip: string; t: number }[] = [];
let t0 = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start a narration clip now; returns a promise that resolves when it has finished playing. */
function say(clip: string) {
  cues.push({ clip, t: Date.now() - t0 });
  return sleep(dur[clip] * 1000 + 400);
}

async function run(page: Page, instruction: string, startClip: string, opts: { lead?: number; endClip?: string } = {}) {
  await page.fill("#rx-instruction", instruction);
  const spoken = say(startClip);
  // Fast runs: click near the end of the line so the result lands as the sentence ends.
  if (opts.lead !== undefined) await sleep(Math.max(0, dur[startClip] * 1000 - opts.lead));
  await page.getByRole("button", { name: "Run agent" }).click();
  await page.getByRole("button", { name: "Stop" }).waitFor();
  await page.getByRole("button", { name: "Run agent" }).waitFor({ timeout: 180_000 });
  await spoken;
  await sleep(700);
  if (opts.endClip) await say(opts.endClip);
}

async function main() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await fetch(`${base}/api/reflex/reset`, { method: "POST" });
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${out}/raw`, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  t0 = Date.now();
  await page.goto(base);
  await sleep(1500);

  await say("intro");
  await run(page, "Book a Demo call for Priya Sharma (priya@acme.io) on Thursday at 3:00 PM, team size 11-50.", "run1_start", { endClip: "run1_end" });
  await run(page, "Book a Demo call for Arjun Mehta (arjun@zeta.dev) on Friday at 10:00 AM, team size 51-200.", "run2_start", { lead: 3500, endClip: "run2_end" });
  await run(page, "Schedule an Onboarding session for Meera Nair, meera@orbit.in, Monday 2:00 PM, team of 1-10.", "run3_start", { lead: 3500 });
  await page.getByText("Shuffled layout", { exact: true }).click();
  await run(page, "Book a Support call for Kabir Rao (kabir@nimbus.co) on Tuesday at 9:00 AM, team size 200+.", "run4_start", { lead: 3500 });
  await page.getByText("Renamed labels", { exact: true }).click();
  await run(page, "Book a Demo call for Ishaan Gupta (ishaan@lumen.ai) on Wednesday at 4:00 PM, team size 11-50.", "run5_start", { endClip: "run5_end" });
  await run(page, "Book a Demo call for Tara Iyer (tara@quanta.io) on Thursday at 11:00 AM, team size 1-10.", "run6_start", { lead: 2500 });

  await page.getByRole("button", { name: /why moss/i }).first().click();
  await sleep(600);
  await page.getByRole("button", { name: /measure/i }).first().click();
  await say("moss");
  await sleep(1500);
  await ctx.close();
  await browser.close();

  const raw = `${out}/raw/${readdirSync(`${out}/raw`).find((f) => f.endsWith(".webm"))}`;
  const args = ["-y", "-i", raw];
  for (const c of cues) args.push("-i", `out/narration/${c.clip}.aiff`);
  const chains = cues.map((c, i) => `[${i + 1}:a]adelay=${c.t}|${c.t}[a${i}]`).join(";");
  const mix = cues.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${cues.length}:normalize=0[aout]`;
  args.push("-filter_complex", `${chains};${mix}`, "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", `${out}/reflex-demo.mp4`);
  execFileSync("ffmpeg", args, { stdio: "ignore" });
  console.log("cues", JSON.stringify(cues));
  console.log("wrote", `${out}/reflex-demo.mp4`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
