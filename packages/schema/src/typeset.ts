/* eslint-disable @typescript-eslint/unbound-method */
import type * as L from "luxon";

import type * as Stubs from "./stubs";
import * as UtilFns from "./util";
import { Cmp } from "./util";

export interface ITypeMap {
  array: { known: IType[]; unknown: IType };
  boolean: null | boolean;
  date: null | L.DateTime;
  duration: null | L.Duration;
  function: (...args: IType[]) => IType;
  link: Stubs.Link;
  null: null;
  number: null | number;
  object: { known: Map<string, IType>; unknown: IType };
  string: null | string;
  widget: Stubs.Widget;
}
export type IType = ["any"] | ["never", ...string[]] | IVals;
export type IVals = [IVal, ...IVal[]];
export type IVal = {
  [K in keyof ITypeMap]: [K, ITypeMap[K], ...Array<ITypeMap[K]>];
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
    const res = UnionFns.and(a, b);
    if (res.length === 0) return NeverFns.error(a, b);
    return res as IVals;
  },
  string(value: IType): string {
    // any
    if (value[0] === "any") return "any";

    // never
    if (value[0] === "never") return NeverFns.string(value.slice(1));

    // vals
    return value
      .flatMap((val) => val.slice(1).map(fns(val[0]).string))
      .join(" or ");
  }
};

export const UnionFns = {
  or(as: IVals, bs: IVals): IVals {
    return [...UtilFns.or<IVal>(as, bs, ValFns.or, ValFns.compare)] as IVals;
  },
  and(as: IVals, bs: IVals): IVals | [] {
    return [...UtilFns.and<IVal>(as, bs, ValFns.and, ValFns.compare)] as
      | IVals
      | [];
  },
  compare(as: IVals, bs: IVals): number {
    return UtilFns.compare(as, bs, ValFns.compare);
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

export const NeverFns = {
  or(as: string[], bs: string[]): string[] {
    return [...UtilFns.or(as, bs, StringFns._or, StringFns._compare)];
  },
  and(as: string[], bs: string[]): string[] {
    return [...UtilFns.and(as, bs, StringFns._and, StringFns._compare)];
  },
  string(val: string[]): string {
    if (val.length === 0) return "never";
    return val.join(" or ");
  },
  error(a: IType, b: IType): IType {
    return [
      "never",
      `Can't combine '${TypeFns.string(a)}' and '${TypeFns.string(b)}'.`
    ];
  }
};

interface IFnsType<T> {
  or: (a: T, b: T) => [T] | [T, T];
  and: (a: T, b: T) => [] | [T];
  cmp: (a: T, b: T) => Cmp;
  compare: (a: T, b: T) => number;
  string: (value: T) => string;
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
}
type IValueFnsArgs<K extends keyof ITypeMap> = Optional<
  IValueFns<K>,
  "_or" | "_and" | "_cmp" | "_string"
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
    _string: args._string ?? JSON.stringify
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
      return value === null ? key : fns._string(value);
    },
    ...fns
  };
};

export const NullFns = baseFns<"null">(() => ({
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  compare: () => 0,
  string: () => "null"
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

export const DateFns = unitFns("date", () => ({
  _compare: (a: L.DateTime, b: L.DateTime) => a.toMillis() - b.toMillis()
}));

export const DurationFns = unitFns("duration", () => ({
  _compare: (a: L.Duration, b: L.Duration) => a.toMillis() - b.toMillis()
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
    }
  };
});

export const Fns = {
  array: ArrayFns,
  boolean: BooleanFns,
  date: DateFns,
  duration: DurationFns,
  function: () => {
    throw new Error("TODO");
  },
  link: () => {
    throw new Error("TODO");
  },
  null: NullFns,
  number: NumberFns,
  object: ObjectFns,
  string: StringFns,
  widget: () => {
    throw new Error("TODO");
  }
};

const fns = <K extends keyof typeof Fns>(key: K): IFnsType<unknown> =>
  Fns[key] as IFnsType<unknown>;
