import { handle } from "@/server/http";
import { stats } from "@/server/reflexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Also initialises the store and warms the embedder on first call. */
export function GET() {
  return handle(stats);
}
