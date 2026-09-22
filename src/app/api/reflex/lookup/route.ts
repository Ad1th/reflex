import type { LookupRequest } from "@/lib/types";
import { handle } from "@/server/http";
import { lookup } from "@/server/reflexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as LookupRequest & { threshold?: number };
    return lookup({ flow: body.flow, stateKey: body.stateKey }, body.threshold ?? 0.9);
  });
}
