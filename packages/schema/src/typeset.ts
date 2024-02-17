export type IUnionMap = {
  any: null;
  never: string[];
  union: IValue;
};
export type IValueMap = {
  null: null;
  number: null | number;
  string: null | string;
  array: { known: IType[]; unknown: IType };
};
export type ITypeMap = IUnionMap & IValueMap;

export type IUnion = {
  [K in keyof IUnionMap]: [K, ITypeMap[K]];
}[keyof IUnionMap];
export type IValue = { [K in keyof IValueMap]: ITypeOf<K> }[keyof IValueMap];
export type IType = IUnion | IValue;

export type ITypeOf<K extends keyof ITypeMap> = [K, ...ITypeMap[K][]];

type IFnsType<T> = {
  or(a: T, b: T): [T] | [T, T];
  and(a: T, b: T): [] | [T];
  cmp(a: T, b: T): Cmp;
  compare(a: T, b: T): number;
  string(value: T): string;
  json(value: T): json;
};

type IFns<K extends keyof ITypeMap> = IFnsType<ITypeMap[K]>;

export const head = <K extends keyof ITypeMap>(type: ITypeOf<K>) => type[0];
export const tail = <K extends keyof ITypeMap>(type: ITypeOf<K>) =>
  type.slice(1) as ITypeMap[K][];
export const split = <K extends keyof ITypeMap>(type: ITypeOf<K>) =>
  [head(type), tail(type)] as const;

export const TypeFns = {
  union(a: IUnion, b: IUnion): IUnion {
    if (a[0] === "any" || b[0] === "any") return a;
    if (a[0] === "never" && b[0] === "never") {
      return ["never", NeverFns.or(a[1], b[1])[0]];
    }
    if (a[0] === "never") return b;
    if (b[0] === "never") return a;

    throw "TODO";
  },
};

export const UtilFns = {
  *intersect<V>(
    as: V[],
    bs: V[],
    and: (a: V, b: V) => [] | [V],
    compare: (a: V, b: V) => number,
  ) {
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
      if (compare(a, b) <= 0) {
        ai++;
      } else {
        bi++;
      }
    }
  },
  *union<V>(
    as: V[],
    bs: V[],
    or: (a: V, b: V) => [V] | [V, V],
    compare: (a: V, b: V) => number,
  ) {
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
      if (compare(a, b) <= 0) {
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
  },
};

type INonNullFn<K extends keyof ITypeMap, Fn extends keyof IFns<K>> = IFnsType<
  Exclude<ITypeMap[K], null>
>[Fn];

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type IValueFns<K extends keyof ITypeMap> = {
  _or: INonNullFn<K, "or">;
  _and: INonNullFn<K, "and">;
  _cmp: INonNullFn<K, "cmp">;
  _compare: INonNullFn<K, "compare">;
  _string: INonNullFn<K, "string">;
  _json: INonNullFn<K, "json">;
};
type IValueFnsArgs<K extends keyof ITypeMap> = Optional<
  IValueFns<K>,
  "_or" | "_and" | "_cmp" | "_string" | "_json"
>;

const UnitFns = <K extends keyof ITypeMap>(
  key: K,
  argsFn: () => Partial<IFns<K>> & IValueFnsArgs<K>,
): IFns<K> & IValueFns<K> => {
  type NonNull = Exclude<ITypeMap[K], null>;
  const args = argsFn();
  const _or =
    args._or ||
    ((a, b) => {
      const sort = _compare(a, b);
      return sort === 0 ? [a] : sort < 0 ? [a, b] : [b, a];
    });
  const _and = args._and || ((a, b) => (_compare(a, b) === 0 ? [a] : []));
  const _cmp =
    args._cmp || ((a, b) => (_compare(a, b) === 0 ? Cmp.Equal : Cmp.Disjoint));
  const _compare = args._compare;
  const _string = args._string || String;
  const _json = args._json || ((value) => value);

  return {
    or(a, b) {
      if (a === null) return [a];
      if (b === null) return [b];
      return _or(a as NonNull, b as NonNull);
    },
    _or,
    and(a, b) {
      if (a === null) return [b];
      if (b === null) return [a];
      return _and(a as NonNull, b as NonNull);
    },
    _and,
    cmp(a, b) {
      if (a === null && b === null) return Cmp.Equal;
      if (a === null) return Cmp.Superset;
      if (b === null) return Cmp.Subset;
      return _cmp(a as NonNull, b as NonNull);
    },
    _cmp,
    compare(a, b) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return _compare(a as NonNull, b as NonNull);
    },
    _compare,
    string(value) {
      return value === null ? key : _string(value as NonNull);
    },
    _string,
    json(value) {
      if (value === null) return { type: key };
      return { type: key, value: _json(value as NonNull) } as json;
    },
    _json,
  };
};

export const NullFns: IFns<"null"> = {
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  compare: () => 0,
  string: () => "null",
  json: () => null,
};

export const NumberFns = UnitFns("number", () => ({
  _compare: (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1),
}));

export const StringFns = UnitFns("string", () => ({
  _compare: (a: string, b: string) => a.localeCompare(b),
}));

export const ArrayFns: IFns<"array"> = {
  or(a, b) {
    throw "TODO";
  },
  and(a, b) {
    throw "TODO";
  },
  cmp(a, b) {
    throw "TODO";
  },
  compare(a, b) {
    throw "TODO";
  },
  string(value) {
    throw "TODO";
  },
  json(value) {
    throw "TODO";
  },
};

export const AnyFns: IFns<"null"> = {
  or(a, b) {
    throw "TODO";
  },
  and(a, b) {
    throw "TODO";
  },
  cmp(a, b) {
    throw "TODO";
  },
  compare(a, b) {
    throw "TODO";
  },
  string(value) {
    throw "TODO";
  },
  json(value) {
    throw "TODO";
  },
};

export const NeverFns: IFns<"never"> = {
  or(as, bs): [string[]] {
    return [[...UtilFns.union(as, bs, StringFns._or, StringFns._compare)]];
  },
  and(as, bs) {
    return [[...UtilFns.intersect(as, bs, StringFns._and, StringFns._compare)]];
  },
  cmp(a, b) {
    throw "TODO";
  },
  compare(a, b) {
    throw "TODO";
  },
  string(value) {
    throw "TODO";
  },
  json(value) {
    throw "TODO";
  },
};

export const UnionFns: IFns<"union"> = {
  or(a, b) {
    throw "TODO";
  },
  and(a, b) {
    throw "TODO";
  },
  cmp(a, b) {
    throw "TODO";
  },
  compare(a, b) {
    throw "TODO";
  },
  string(value) {
    throw "TODO";
  },
  json(value) {
    throw "TODO";
  },
};

export const Fns = {
  never: NeverFns,
  null: NullFns,
  number: NumberFns,
  string: StringFns,
  util: UtilFns,
};

export const enum Cmp {
  Equal = 0b00, // 0
  Subset = 0b01, // 1
  Superset = 0b10, // 2
  Disjoint = 0b11, // 3
}

type json =
  | null
  | string
  | number
  | boolean
  | Date
  | json[]
  | { [key: string]: json };
