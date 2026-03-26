import { and, eq, lt } from 'drizzle-orm';
import { db } from '../index.js';
import { idempotencyKeys } from '../schema.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyRecord = typeof idempotencyKeys.$inferSelect;

export type ReserveIdempotencyResult =
  | {
      kind: 'reserved';
      recordId: string;
      requestHash: string;
      statusCode: number | null;
      responseBody: unknown;
    }
  | {
      kind: 'replay';
      recordId: string;
      requestHash: string;
      statusCode: number;
      responseBody: unknown;
    }
  | {
      kind: 'in_progress';
      recordId: string;
      requestHash: string;
      statusCode: number | null;
      responseBody: unknown;
    }
  | {
      kind: 'conflict';
      recordId: string;
      requestHash: string;
      statusCode: number | null;
      responseBody: unknown;
    };

function buildWhere(scope: string, key: string, method: string, path: string) {
  return and(
    eq(idempotencyKeys.scope, scope),
    eq(idempotencyKeys.idempotencyKey, key),
    eq(idempotencyKeys.method, method),
    eq(idempotencyKeys.path, path),
  );
}

function mapResult(record: IdempotencyRecord, requestHash: string): ReserveIdempotencyResult {
  if (record.requestHash !== requestHash) {
    return {
      kind: 'conflict',
      recordId: record.id,
      requestHash: record.requestHash,
      statusCode: record.statusCode,
      responseBody: record.responseBody,
    };
  }

  if (record.state === 'completed' && record.statusCode !== null) {
    return {
      kind: 'replay',
      recordId: record.id,
      requestHash: record.requestHash,
      statusCode: record.statusCode,
      responseBody: record.responseBody,
    };
  }

  return {
    kind: 'in_progress',
    recordId: record.id,
    requestHash: record.requestHash,
    statusCode: record.statusCode,
    responseBody: record.responseBody,
  };
}

export async function reserveIdempotencyKey(args: {
  scope: string;
  idempotencyKey: string;
  method: string;
  path: string;
  requestHash: string;
}): Promise<ReserveIdempotencyResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
  const where = buildWhere(args.scope, args.idempotencyKey, args.method, args.path);

  await db.delete(idempotencyKeys).where(and(where, lt(idempotencyKeys.expiresAt, now)));

  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      scope: args.scope,
      idempotencyKey: args.idempotencyKey,
      method: args.method,
      path: args.path,
      requestHash: args.requestHash,
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({
      id: idempotencyKeys.id,
      requestHash: idempotencyKeys.requestHash,
      statusCode: idempotencyKeys.statusCode,
      responseBody: idempotencyKeys.responseBody,
    });

  if (inserted[0]) {
    return {
      kind: 'reserved',
      recordId: inserted[0].id,
      requestHash: inserted[0].requestHash,
      statusCode: inserted[0].statusCode,
      responseBody: inserted[0].responseBody,
    };
  }

  const existingRows = await db.select().from(idempotencyKeys).where(where).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    const retryInsert = await db
      .insert(idempotencyKeys)
      .values({
        scope: args.scope,
        idempotencyKey: args.idempotencyKey,
        method: args.method,
        path: args.path,
        requestHash: args.requestHash,
        expiresAt,
      })
      .returning({
        id: idempotencyKeys.id,
        requestHash: idempotencyKeys.requestHash,
        statusCode: idempotencyKeys.statusCode,
        responseBody: idempotencyKeys.responseBody,
      });

    return {
      kind: 'reserved',
      recordId: retryInsert[0]!.id,
      requestHash: retryInsert[0]!.requestHash,
      statusCode: retryInsert[0]!.statusCode,
      responseBody: retryInsert[0]!.responseBody,
    };
  }

  return mapResult(existing, args.requestHash);
}

export async function finalizeIdempotencyKey(
  recordId: string,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  await db
    .update(idempotencyKeys)
    .set({
      state: 'completed',
      statusCode,
      responseBody: responseBody ?? null,
      updatedAt: new Date(),
    })
    .where(eq(idempotencyKeys.id, recordId));
}

/** Deletes rows past TTL (global sweep; per-key deletes also run on reserve). */
export async function deleteExpiredIdempotencyKeys(): Promise<number> {
  const now = new Date();
  const deleted = await db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now)).returning({ id: idempotencyKeys.id });
  return deleted.length;
}
