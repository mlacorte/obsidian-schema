export type ITypeMap = {
  null: null;
  number: null | number;
  string: null | string;
  array: { known: IType[]; unknown: IType };
  object: { known: Map<string, IType>; unknown: IType };
};
export type IType = ["any"] | ["never", ...string[]] | IVal[];
export type IVal = {
  [K in keyof ITypeMap]: [K, ...ITypeMap[K][]];
}[keyof ITypeMap];

export const TypeFns = {
  or(as: IType, bs: IType): IType {
    // any
    if (as[0] === "any" || bs[0] === "any") return as;

    // never
    if (as[0] === "never" && bs[0] === "never") {
      return ["never", ...NeverFns.or(as.slice(1), bs.slice(1))];
    }
    if (as[0] === "never") return bs;
    if (bs[0] === "never") return as;

    // vals
    return UnionFns.or(as, bs);
  },
};

export const UnionFns = {
  or(as: IVal[], bs: IVal[]): IVal[] {
    return [...UtilFns.union<IVal>(as, bs, ValFns.or, ValFns.compare)];
  },
  compare(as: IVal[], bs: IVal[]): number {
    return UtilFns.compare(as, bs, ValFns.compare);
  },
};

export const ValFns = {
  or(a: IVal, b: IVal): [IVal] | [IVal, IVal] {
    if (a[0] === b[0]) {
      const { or, compare } = fns(a[0]);
      return [
        [a[0], ...UtilFns.union(a.slice(0), b.slice(0), or, compare)] as IVal,
      ];
    } else {
      return StringFns._compare(a[0], b[0]) < 0 ? [a, b] : [b, a];
    }
  },
  compare(a: IVal, b: IVal): number {
    const typeSort = StringFns._compare(a[0], b[0]);
    if (typeSort !== 0) return typeSort;
    return UtilFns.compare(a.slice(1), b.slice(1), fns(a[0]).compare);
  },
};

export const NeverFns = {
  or(as: string[], bs: string[]): string[] {
    return [...UtilFns.union(as, bs, StringFns._or, StringFns._compare)];
  },
  intersect(as: string[], bs: string[]): string[] {
    return [...UtilFns.intersect(as, bs, StringFns._and, StringFns._compare)];
  },
};

type IFnsType<T> = {
  or(a: T, b: T): [T] | [T, T];
  and(a: T, b: T): [] | [T];
  cmp(a: T, b: T): Cmp;
  compare(a: T, b: T): number;
  string(value: T): string;
  json(value: T): json;
};

type IFns<K extends keyof ITypeMap> = IFnsType<ITypeMap[K]>;

const baseFns = <K extends keyof ITypeMap>(fn: () => IFns<K>) => fn();

type INonNullFn<
  K extends keyof ITypeMap,
  Fn extends keyof IFnsType<K>,
> = IFnsType<Exclude<ITypeMap[K], null>>[Fn];

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

const unitFns = <K extends keyof ITypeMap>(
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
  const _json = args._json || ((value) => value as json);

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

export const NullFns = baseFns<"null">(() => ({
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  compare: () => 0,
  string: () => "null",
  json: () => null,
}));

export const NumberFns = unitFns("number", () => ({
  _compare: (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1),
}));

export const StringFns = unitFns("string", () => ({
  _compare: (a: string, b: string) => a.localeCompare(b),
}));

export const ArrayFns = baseFns<"array">(() => {
  const { union, intersect } = UtilFns;
  const { _or: _union, _and: _intersect, _compare } = NumberFns;
  const unionIdx = (as: number[], bs: number[]) =>
    union(as, bs, _union, _compare);

  return {
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
});

export const ObjectFns = baseFns<"object">(() => {
  return {
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
});

export const Fns = {
  null: NullFns,
  number: NumberFns,
  string: StringFns,
  array: ArrayFns,
  object: ObjectFns,
};

const fns = <K extends keyof typeof Fns>(key: K): IFnsType<unknown> => Fns[key];

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
      if (compare(a, b) < 0) {
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
  },
  compare<V>(as: V[], bs: V[], compareFn: (a: V, b: V) => number): number {
    const len = Math.min(as.length, bs.length);

    for (let i = 0; i < len; i++) {
      const sort = compareFn(as[i], bs[i]);
      if (sort !== 0) return sort;
    }

    return as.length - bs.length;
  },
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
