import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { SensitiveCategory } from "@/domain/enums";
import { attachmentBlobs, attachments, decisions, inboxItems, people, projects, tasks } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
export const ENTITY_TYPES = ["project", "task", "person", "decision"] as const;
export type AttachmentEntity = (typeof ENTITY_TYPES)[number];

async function assertEntity(ctx: Ctx, type: AttachmentEntity, id: string) {
  const table = { project: projects, task: tasks, person: people, decision: decisions }[type];
  const [row] = await ctx.tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.userId, ctx.userId)));
  if (!row) throw new UserFacingError("No encontré el elemento al que quieres adjuntar.", "NOT_FOUND");
}

function safeName(name: string): string {
  return name.replace(/[\\/\r\n"]/g, "_").slice(0, 180) || "archivo";
}

/**
 * Stores the file in Postgres (bytea, max 5 MB) behind RLS. `storage_key`
 * keeps the door open to object storage (Supabase Storage/S3) later.
 */
export async function saveAttachment(ctx: Ctx, file: { name: string; type: string; bytes: Buffer }, link: { entityType?: AttachmentEntity | null; entityId?: string | null; sensitive?: SensitiveCategory | null } = {}) {
  if (file.bytes.length === 0) throw new UserFacingError("El archivo está vacío.");
  if (file.bytes.length > MAX_ATTACHMENT_BYTES) throw new UserFacingError("El archivo supera 5 MB.");
  if (!ALLOWED_MIME.has(file.type)) throw new UserFacingError("Tipo de archivo no permitido (PDF, imagen, Word, Excel o texto).");
  if (link.entityType && link.entityId) await assertEntity(ctx, link.entityType, link.entityId);
  const [row] = await ctx.tx
    .insert(attachments)
    .values({
      userId: ctx.userId,
      filename: safeName(file.name),
      mimeType: file.type,
      sizeBytes: file.bytes.length,
      storageKey: `db:${randomUUID()}`,
      entityType: link.entityType ?? null,
      entityId: link.entityId ?? null,
      sensitiveCategory: link.sensitive ?? null,
    })
    .returning();
  await ctx.tx.insert(attachmentBlobs).values({ attachmentId: row.id, userId: ctx.userId, data: file.bytes });
  if (!link.entityType) {
    // Loose documents land in the Inbox so they are never forgotten.
    await ctx.tx.insert(inboxItems).values({ userId: ctx.userId, rawText: `Documento: ${row.filename}`, type: "DOCUMENT_REFERENCE", status: "PROCESSED", source: "CHAT", resultEntityType: "attachment", resultEntityId: row.id, processedAt: ctx.now });
  }
  return row;
}

export async function listAttachments(ctx: Ctx, entityType: AttachmentEntity, entityId: string) {
  return ctx.tx
    .select({ id: attachments.id, filename: attachments.filename, mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes, createdAt: attachments.createdAt })
    .from(attachments)
    .where(and(eq(attachments.userId, ctx.userId), eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
    .orderBy(desc(attachments.createdAt));
}

export async function readAttachment(ctx: Ctx, id: string) {
  const [row] = await ctx.tx
    .select({ filename: attachments.filename, mimeType: attachments.mimeType, data: attachmentBlobs.data })
    .from(attachments)
    .innerJoin(attachmentBlobs, eq(attachmentBlobs.attachmentId, attachments.id))
    .where(and(eq(attachments.id, id), eq(attachments.userId, ctx.userId)));
  if (!row) throw new UserFacingError("No encontré ese archivo.", "NOT_FOUND");
  return row;
}

export async function deleteAttachment(ctx: Ctx, id: string) {
  const res = await ctx.tx.delete(attachments).where(and(eq(attachments.id, id), eq(attachments.userId, ctx.userId))).returning({ id: attachments.id });
  if (!res.length) throw new UserFacingError("No encontré ese archivo.", "NOT_FOUND");
}
