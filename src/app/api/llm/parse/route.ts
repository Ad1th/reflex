import type { ParseRequest } from "@/lib/types";
import { parse } from "@/server/groq";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => parse(((await req.json()) as ParseRequest).instruction));
}
