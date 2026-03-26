export function omitNullValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj) as Array<[keyof T, unknown]>) {
    if (value === null) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = value;
  }
  return out;
}

