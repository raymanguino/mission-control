const metrics = {
  replayed: 0,
  conflictPayload: 0,
  inProgressBlocked: 0,
  reserved: 0,
  finalized: 0,
};

export function recordIdempotencyReplayed(): void {
  metrics.replayed += 1;
}

export function recordIdempotencyConflict(): void {
  metrics.conflictPayload += 1;
}

export function recordIdempotencyInProgress(): void {
  metrics.inProgressBlocked += 1;
}

export function recordIdempotencyReserved(): void {
  metrics.reserved += 1;
}

export function recordIdempotencyFinalized(): void {
  metrics.finalized += 1;
}

export function getIdempotencyMetrics(): Readonly<typeof metrics> {
  return { ...metrics };
}
