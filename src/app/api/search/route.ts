import { NextResponse, type NextRequest } from "next/server";
import { runAsUser } from "@/application/context";
import { globalSearch } from "@/application/search";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "search", limit: 120 });
  if (guard instanceof NextResponse) return guard;
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const hits = await runAsUser(getDb(), guard.userId, (ctx) => globalSearch(ctx, q));
    return NextResponse.json({ hits });
  } catch (err) {
    return apiError(err, "api.search");
  }
}
