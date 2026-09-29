import { NextResponse, type NextRequest } from "next/server";
import { runAsUser } from "@/application/context";
import { exportUserData } from "@/application/export";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "export", limit: 5, windowMs: 10 * 60_000 });
  if (guard instanceof NextResponse) return guard;
  try {
    const data = await runAsUser(getDb(), guard.userId, exportUserData);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="lia-export-${data.exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err, "api.export");
  }
}
