import type { LlmStepRequest } from "@/lib/types";
import { step } from "@/server/groq";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => step((await req.json()) as LlmStepRequest));
}
