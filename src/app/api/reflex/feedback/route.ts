import type { FeedbackRequest } from "@/lib/types";
import { handle } from "@/server/http";
import { feedback } from "@/server/reflexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => feedback((await req.json()) as FeedbackRequest));
}
