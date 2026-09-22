import { handle } from "@/server/http";
import { bench } from "@/server/reflexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const n = Math.max(1, Math.min(5000, Number(new URL(req.url).searchParams.get("n")) || 200));
  return handle(() => bench(n));
}
