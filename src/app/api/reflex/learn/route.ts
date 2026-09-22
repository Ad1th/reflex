import type { LearnRequest } from "@/lib/types";
import { handle } from "@/server/http";
import { learn } from "@/server/reflexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => learn((await req.json()) as LearnRequest));
}
