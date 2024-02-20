export type json =
  | null
  | string
  | number
  | boolean
  | Date
  | json[]
  | { [key: string]: json };

export const enum Cmp {
  Equal = 0b00, // 0
  Subset = 0b01, // 1
  Superset = 0b10, // 2
  Disjoint = 0b11 // 3
}

export function* and<V>(
  as: V[],
  bs: V[],
  and: (a: V, b: V) => [] | [V],
  compare: (a: V, b: V) => number
): Generator<V, void, unknown> {
  let ai = 0;
  let bi = 0;

  while (ai < as.length && bi < bs.length) {
    const a = as[ai];
    const b = bs[bi];
    const intersection = and(a, b);

    // merged
    if (intersection.length === 1) {
      yield intersection[0];
      ai++;
      bi++;
      continue;
    }

    // disjoint
    if (compare(a, b) < 0) {
      ai++;
    } else {
      bi++;
    }
  }
}

export function* or<V>(
  as: V[],
  bs: V[],
  or: (a: V, b: V) => [V] | [V, V],
  compare: (a: V, b: V) => number
): Generator<V, void, unknown> {
  let ai = 0;
  let bi = 0;

  while (ai < as.length && bi < bs.length) {
    const a = as[ai];
    const b = bs[bi];
    const union = or(a, b);

    // merged
    if (union.length === 1) {
      yield union[0];
      ai++;
      bi++;
      continue;
    }

    // disjoint
    if (compare(a, b) < 0) {
      yield a;
      ai++;
    } else {
      yield b;
      bi++;
    }
  }

  // remainder
  while (ai < as.length) yield as[ai++];
  while (bi < bs.length) yield bs[bi++];
}

export const cmp = <V>(
  as: V[],
  bs: V[],
  compareFn: (a: V, b: V) => number
): Cmp => {
  let res = Cmp.Equal;
  let ai = 0;
  let bi = 0;

  while (ai < as.length && bi < bs.length) {
    const sort = compareFn(as[ai], bs[bi]);

    if (sort === 0) {
      ai++;
      bi++;
      continue;
    }

    if (sort < 0) {
      ai++;
      res |= Cmp.Superset;
    } else {
      bi++;
      res |= Cmp.Subset;
    }

    if (res === Cmp.Disjoint) return Cmp.Disjoint;
  }

  if (ai < as.length) res |= Cmp.Superset;
  if (bi < bs.length) res |= Cmp.Subset;
  return res;
};

export const compare = <V>(
  as: V[],
  bs: V[],
  compareFn: (a: V, b: V) => number
): number => {
  const len = Math.min(as.length, bs.length);

  for (let i = 0; i < len; i++) {
    const sort = compareFn(as[i], bs[i]);
    if (sort !== 0) return sort;
  }

  return as.length - bs.length;
};
