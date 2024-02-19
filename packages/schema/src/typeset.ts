/* eslint-disable @typescript-eslint/unbound-method */
import * as UtilFns from "./util";
import { Cmp, type json } from "./util";

export interface ITypeMap {
  null: null;
  boolean: null | boolean;
  number: null | number;
  string: null | string;
  array: { known: IType[]; unknown: IType };
  object: { known: Map<string, IType>; unknown: IType };
}
export type IType = ["any"] | ["never", ...string[]] | IVal[];
export type IVal = {
  [K in keyof ITypeMap]: [K, ...Array<ITypeMap[K]>];
}[keyof ITypeMap];

export const TypeFns = {
  or(a: IType, b: IType): IType {
    // any
    if (a[0] === "any" || b[0] === "any") return a;

    // never
    if (a[0] === "never" && b[0] === "never") {
      return ["never", ...NeverFns.or(a.slice(1), b.slice(1))];
    }
    if (a[0] === "never") return b;
    if (b[0] === "never") return a;

    // vals
    return UnionFns.or(a, b);
  },
  and(a: IType, b: IType): IType {
    // any
    if (a[0] === "any") return b;
    if (b[0] === "any") return a;

    // never
    if (a[0] === "never" && b[0] === "never") {
      return ["never", ...NeverFns.and(a.slice(1), b.slice(1))];
    }
    if (a[0] === "never") return a;
    if (b[0] === "never") return b;

    // vals
    return UnionFns.and(a, b);
  }
};

export const ValFns = {
  or(a: IVal, b: IVal): [IVal] | [IVal, IVal] {
    if (a[0] === b[0]) {
      const { or, compare } = fns(a[0]);
      return [
        [a[0], ...UtilFns.or(a.slice(1), b.slice(1), or, compare)] as IVal
      ];
    } else {
      return StringFns._compare(a[0], b[0]) < 0 ? [a, b] : [b, a];
    }
  },
  and(a: IVal, b: IVal): [] | [IVal] {
    if (a[0] !== b[0]) return [];
    const { and, compare } = fns(a[0]);
    const res = [a[0], ...UtilFns.and(a.slice(1), b.slice(1), and, compare)];
    return res.length === 1 ? [] : [res as IVal];
  },
  compare(a: IVal, b: IVal): number {
    const typeSort = StringFns._compare(a[0], b[0]);
    if (typeSort !== 0) return typeSort;
    return UtilFns.compare(a.slice(1), b.slice(1), fns(a[0]).compare);
  }
};

export const UnionFns = {
  or(as: IVal[], bs: IVal[]): IVal[] {
    return [...UtilFns.or<IVal>(as, bs, ValFns.or, ValFns.compare)];
  },
  and(as: IVal[], bs: IVal[]): IVal[] {
    return [...UtilFns.and<IVal>(as, bs, ValFns.and, ValFns.compare)];
  },
  compare(as: IVal[], bs: IVal[]): number {
    return UtilFns.compare(as, bs, ValFns.compare);
  }
};

export const NeverFns = {
  or(as: string[], bs: string[]): string[] {
    return [...UtilFns.or(as, bs, StringFns._or, StringFns._compare)];
  },
  and(as: string[], bs: string[]): string[] {
    return [...UtilFns.and(as, bs, StringFns._and, StringFns._compare)];
  }
};

interface IFnsType<T> {
  or: (a: T, b: T) => [T] | [T, T];
  and: (a: T, b: T) => [] | [T];
  cmp: (a: T, b: T) => Cmp;
  compare: (a: T, b: T) => number;
  string: (value: T) => string;
  json: (value: T) => json;
}

type IFns<K extends keyof ITypeMap> = IFnsType<ITypeMap[K]>;

const baseFns = <K extends keyof ITypeMap>(fn: () => IFns<K>): IFns<K> => fn();

type INonNullFn<
  K extends keyof ITypeMap,
  Fn extends keyof IFnsType<K>
> = IFnsType<Exclude<ITypeMap[K], null>>[Fn];

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

interface IValueFns<K extends keyof ITypeMap> {
  _or: INonNullFn<K, "or">;
  _and: INonNullFn<K, "and">;
  _cmp: INonNullFn<K, "cmp">;
  _compare: INonNullFn<K, "compare">;
  _string: INonNullFn<K, "string">;
  _json: INonNullFn<K, "json">;
}
type IValueFnsArgs<K extends keyof ITypeMap> = Optional<
  IValueFns<K>,
  "_or" | "_and" | "_cmp" | "_string" | "_json"
>;

const unitFns = <K extends keyof ITypeMap>(
  key: K,
  argsFn: () => Partial<IFns<K>> & IValueFnsArgs<K>
): IFns<K> & IValueFns<K> => {
  type NonNull = Exclude<ITypeMap[K], null>;
  const args = argsFn();
  const fns = {
    ...args,
    _or:
      args._or ??
      ((a, b) => {
        const sort = args._compare(a, b);
        return sort === 0 ? [a] : sort < 0 ? [a, b] : [b, a];
      }),
    _and: args._and ?? ((a, b) => (args._compare(a, b) === 0 ? [a] : [])),
    _cmp:
      args._cmp ??
      ((a, b) => (args._compare(a, b) === 0 ? Cmp.Equal : Cmp.Disjoint)),
    _string: args._string ?? String,
    _json: args._json ?? ((value) => value as json)
  };

  return {
    or(a, b) {
      if (a === null) return [a];
      if (b === null) return [b];
      return fns._or(a as NonNull, b as NonNull);
    },
    and(a, b) {
      if (a === null) return [b];
      if (b === null) return [a];
      return fns._and(a as NonNull, b as NonNull);
    },
    cmp(a, b) {
      if (a === null && b === null) return Cmp.Equal;
      if (a === null) return Cmp.Superset;
      if (b === null) return Cmp.Subset;
      return fns._cmp(a as NonNull, b as NonNull);
    },
    compare(a, b) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return fns._compare(a as NonNull, b as NonNull);
    },
    string(value) {
      return value === null ? key : fns._string(value as NonNull);
    },
    json(value): { type: typeof key } | { type: typeof key; value: json } {
      if (value === null) return { type: key };
      return { type: key, value: fns._json(value as NonNull) };
    },
    ...fns
  };
};

export const NullFns = baseFns<"null">(() => ({
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  compare: () => 0,
  string: () => "null",
  json: () => null
}));

export const BooleanFns = unitFns("boolean", () => ({
  // promote true | false to boolean
  or(a, b) {
    if (a === null || b === null || (a && !b) || (b && !a)) return [null];
    return [a && b];
  },
  _compare: (a: boolean, b: boolean) => (a === b ? 0 : a < b ? -1 : 1)
}));

export const NumberFns = unitFns("number", () => ({
  _compare: (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1)
}));

export const StringFns = unitFns("string", () => ({
  _compare: (a: string, b: string) => a.localeCompare(b)
}));

export const ArrayFns = baseFns<"array">(() => {
  return {
    or(_a, _b) {
      throw new Error("TODO");
    },
    and(_a, _b) {
      throw new Error("TODO");
    },
    cmp(_a, _b) {
      throw new Error("TODO");
    },
    compare(_a, _b) {
      throw new Error("TODO");
    },
    string(_value) {
      throw new Error("TODO");
    },
    json(_value) {
      throw new Error("TODO");
    }
  };
});

export const ObjectFns = baseFns<"object">(() => {
  return {
    or(_a, _b) {
      throw new Error("TODO");
    },
    and(_a, _b) {
      throw new Error("TODO");
    },
    cmp(_a, _b) {
      throw new Error("TODO");
    },
    compare(_a, _b) {
      throw new Error("TODO");
    },
    string(_value) {
      throw new Error("TODO");
    },
    json(_value) {
      throw new Error("TODO");
    }
  };
});

export const Fns = {
  null: NullFns,
  boolean: BooleanFns,
  number: NumberFns,
  string: StringFns,
  array: ArrayFns,
  object: ObjectFns
};

const fns = <K extends keyof typeof Fns>(key: K): IFnsType<unknown> =>
  Fns[key] as IFnsType<unknown>;
