export const enum Cmp {
  DisjointLt = -2,
  Subset = -1,
  Equal = 0,
  Superset = 1,
  DisjointGt = 2
}

export type IDisjoint = Cmp.DisjointLt | Cmp.DisjointGt;
export type INonDisjoint = Cmp.Subset | Cmp.Equal | Cmp.Superset;

// TODO: convert args to iterators
export function* and<V>(
  as: V[],
  bs: V[],
  and: (a: V, b: V) => [] | [V],
  cmpFn: (a: V, b: V, sortOnly?: boolean) => Cmp
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
    if (cmpFn(a, b, true) < 0) {
      ai++;
    } else {
      bi++;
    }
  }
}

// TODO: convert args to iterators
export function* or<V>(
  as: V[],
  bs: V[],
  or: (a: V, b: V) => [V] | [V, V]
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
    if (union[0] === a) {
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

export const isDisjoint = (val: Cmp): val is IDisjoint =>
  val === Cmp.DisjointLt || val === Cmp.DisjointGt;

export const isNonDisjoint = (val: Cmp): val is INonDisjoint =>
  !isDisjoint(val);

export const cmpJoin = (prev: INonDisjoint, curr: Cmp): Cmp => {
  if (curr === Cmp.Equal) return prev;
  if (prev < Cmp.Equal && curr > Cmp.Equal) return Cmp.DisjointLt;
  if (prev > Cmp.Equal && curr < Cmp.Equal) return Cmp.DisjointGt;
  return curr;
};

// TODO: convert args to iterators
export const cmp = <V>(
  as: V[],
  bs: V[],
  cmpFn: (a: V, b: V, sortOnly?: boolean) => Cmp,
  sortOnly = false,
  orig: Cmp = Cmp.Equal
): Cmp => {
  if (sortOnly && orig !== Cmp.Equal) return orig;
  if (isDisjoint(orig)) return orig;

  let res: Cmp = orig;
  let ai = 0;
  let bi = 0;

  while (ai < as.length && bi < bs.length) {
    const a = as[ai];
    const b = bs[bi];
    const cmp = cmpFn(a, b, sortOnly);

    if (sortOnly && cmp !== Cmp.Equal) return cmp;

    if (isNonDisjoint(cmp)) {
      res = cmpJoin(res, cmp);
      if (isDisjoint(res)) return res;
      ai++;
      bi++;
      continue;
    }

    if (cmp < Cmp.Equal) {
      ai++;
      res = cmpJoin(res, Cmp.Superset);
    } else {
      bi++;
      res = cmpJoin(res, Cmp.Subset);
    }

    if (isDisjoint(res)) return res;
  }

  if (ai < as.length) return cmpJoin(res, Cmp.Superset);
  if (bi < bs.length) return cmpJoin(res, Cmp.Subset);
  return res;
};

export function* map<A, B>(iter: Iterable<A>, fn: (val: A) => B): Iterable<B> {
  for (const curr of iter) {
    yield fn(curr);
  }
}

export function* cartesian<V>(vals: Array<Iterable<V>>): Iterable<V[]> {
  const head = [...vals[0]] ?? [];
  const tail = vals.slice(1);
  const remainder = tail.length > 0 ? cartesian(tail) : [[]];
  for (const r of remainder) for (const h of head) yield [h, ...r];
}
