import { handle } from "@/server/http";
import { resetLive } from "@/server/reflexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST() {
  return handle(resetLive);
}
