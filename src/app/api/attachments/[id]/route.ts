import { NextResponse, type NextRequest } from "next/server";
import { deleteAttachment, readAttachment } from "@/application/attachments";
import { runAsUser } from "@/application/context";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await guardApi(req, { bucket: "download", limit: 60 });
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const file = await runAsUser(getDb(), guard.userId, (ctx) => readAttachment(ctx, id));
    const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    return apiError(err, "api.attachments.read");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await guardApi(req, { bucket: "upload", limit: 30 });
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    await runAsUser(getDb(), guard.userId, (ctx) => deleteAttachment(ctx, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "api.attachments.delete");
  }
}
