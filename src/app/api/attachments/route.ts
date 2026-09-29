import { NextResponse, type NextRequest } from "next/server";
import { ENTITY_TYPES, MAX_ATTACHMENT_BYTES, saveAttachment, type AttachmentEntity } from "@/application/attachments";
import { runAsUser, UserFacingError } from "@/application/context";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "upload", limit: 20 });
  if (guard instanceof NextResponse) return guard;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new UserFacingError("Adjunta un archivo.");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new UserFacingError("El archivo supera 5 MB.");
    const entityType = form.get("entityType");
    const entityId = form.get("entityId");
    const type = typeof entityType === "string" && (ENTITY_TYPES as readonly string[]).includes(entityType) ? (entityType as AttachmentEntity) : null;
    const bytes = Buffer.from(await file.arrayBuffer());
    const row = await runAsUser(getDb(), guard.userId, (ctx) =>
      saveAttachment(ctx, { name: file.name, type: file.type, bytes }, { entityType: type, entityId: typeof entityId === "string" && entityId ? entityId : null }),
    );
    return NextResponse.json({ id: row.id, filename: row.filename, sizeBytes: row.sizeBytes }, { status: 201 });
  } catch (err) {
    return apiError(err, "api.attachments.upload");
  }
}
