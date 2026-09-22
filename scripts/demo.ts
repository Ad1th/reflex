// Drives the real mission-control UI through the demo script, saving screenshots + a screen recording.
// Usage: pnpm exec tsx scripts/demo.ts [baseUrl]   → out/demo/*.png, out/demo/video/*.webm
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "out/demo";

const R4 = "Book a Support call for Kabir Rao (kabir@nimbus.co) on Tuesday at 9:00 AM, team size 200+.";
const R5 = "Book a Demo call for Ishaan Gupta (ishaan@lumen.ai) on Wednesday at 4:00 PM, team size 11-50.";
const R6 = "Book a Demo call for Tara Iyer (tara@quanta.io) on Thursday at 11:00 AM, team size 1-10.";

async function run(page: Page, instruction: string, shot: string) {
  await page.fill("#rx-instruction", instruction);
  await page.getByRole("button", { name: "Run agent" }).click();
  await page.getByRole("button", { name: "Stop" }).waitFor();
  await page.getByRole("button", { name: "Run agent" }).waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${shot}.png` });
}

async function chaos(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  await page.waitForTimeout(400);
}

async function main() {
  mkdirSync(out, { recursive: true });
  await fetch(`${base}/api/reflex/reset`, { method: "POST" });
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/0-empty.png` });

  await run(page, "Book a Demo call for Priya Sharma (priya@acme.io) on Thursday at 3:00 PM, team size 11-50.", "1-cold");
  await run(page, "Book a Demo call for Arjun Mehta (arjun@zeta.dev) on Friday at 10:00 AM, team size 51-200.", "2-warm");
  await run(page, "Schedule an Onboarding session for Meera Nair, meera@orbit.in, Monday 2:00 PM, team of 1-10.", "3-rephrased");
  await chaos(page, "Shuffled layout");
  await run(page, R4, "4-shuffled");
  await chaos(page, "Renamed labels");
  await run(page, R5, "5-renamed");
  await run(page, R6, "6-renamed-again");

  const why = page.getByRole("button", { name: /why moss/i });
  if (await why.count()) {
    await why.first().click();
    await page.waitForTimeout(500);
    const bench = page.getByRole("button", { name: /measure/i });
    if (await bench.count()) await bench.first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/7-why-moss.png` });
  }
  await ctx.close();
  await browser.close();
  console.log("saved to", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
