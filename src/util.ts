export function updateObj<
  K extends string | number | symbol,
  T extends Record<K, unknown>
>(object: T, key: K, fn: (old: T[K] | undefined) => T[K] | undefined) {
  const res = fn(object[key]);

  if (res === undefined) {
    delete object[key];
  } else {
    object[key] = res;
  }
}

export function mergeObj<T extends Record<string | number | symbol, unknown>>(
  left: T,
  right: T,
  fn: <K extends keyof T>(key: K) => any
): T {
  const res = {} as T;

  for (const key of unionIter<keyof T>(Object.keys(left), Object.keys(right))) {
    const val = fn(key);

    if (val !== undefined) {
      res[key] = val;
    }
  }

  return res;
}

export function unionIter<T>(left: Iterable<T>, right: Iterable<T>): Set<T> {
  return new Set<T>([...left, ...right]);
}

export function intersectIter<T>(
  left: Iterable<T>,
  right: Iterable<T>
): Set<T> {
  const r = right instanceof Set ? right : new Set(right);
  return new Set<T>([...left].filter((v) => r.has(v)));
}
