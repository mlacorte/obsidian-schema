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
    return [...UtilFns.or<IVal>(a, b, ValFns.or)] as IVals;
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
    const res = [...UtilFns.and<IVal>(a, b, ValFns.and, ValFns.cmp)];
    if (res.length === 0) return NeverFns.error(a, b);
    return res as IVals;
  },
  cmp(a: IType, b: IType, sortOnly = false): Cmp {
    // any
    if (a[0] === "any" && b[0] === "any") return Cmp.Equal;
    if (a[0] === "any" && b[0] !== "any") return Cmp.Superset;
    if (b[0] === "any" && a[0] !== "any") return Cmp.Subset;

    // never
    if (a[0] === "never" && b[0] === "never") {
      return NeverFns.cmp(a.slice(1), b.slice(1), sortOnly);
    }
    if (a[0] === "never" && b[0] !== "never") return Cmp.Subset;
    if (b[0] === "never" && a[0] !== "never") return Cmp.Superset;

    // vals
    return UtilFns.cmp(a as IVals, b as IVals, ValFns.cmp, sortOnly);
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

export const ValFns = {
  or(a: IVal, b: IVal): [IVal] | [IVal, IVal] {
    if (a[0] !== b[0]) {
      return StringFns._cmp(a[0], b[0]) < 0 ? [a, b] : [b, a];
    }

    return [
      [a[0], ...UtilFns.or(a.slice(1), b.slice(1), fns(a[0]).or)] as IVal
    ];
  },
  and(a: IVal, b: IVal): [] | [IVal] {
    if (a[0] !== b[0]) return [];
    const { and, cmp } = fns(a[0]);
    const res = [a[0], ...UtilFns.and(a.slice(1), b.slice(1), and, cmp)];
    return res.length === 1 ? [] : [res as IVal];
  },
  cmp(a: IVal, b: IVal, sortOnly = false): Cmp {
    const cmpVal = StringFns._cmp(a[0], b[0], sortOnly);
    return UtilFns.cmp(a.slice(1), b.slice(1), fns(a[0]).cmp, sortOnly, cmpVal);
  }
};

export const NeverFns = {
  or(as: string[], bs: string[]): string[] {
    return [...UtilFns.or(as, bs, StringFns._or)];
  },
  and(as: string[], bs: string[]): string[] {
    return [...UtilFns.and(as, bs, StringFns._and, StringFns._cmp)];
  },
  cmp(as: string[], bs: string[], sortOnly = false): Cmp {
    return UtilFns.cmp(as, bs, StringFns._cmp, sortOnly);
  },
  string(val: string[]): string {
    if (val.length === 0) return "never";
    return val.map((s) => `error(${JSON.stringify(s)})`).join(" or ");
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
  cmp: (a: T, b: T, sortOnly?: boolean) => Cmp;
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
  _string: INonNullFn<K, "string">;
}
type IValueFnsArgs<K extends keyof ITypeMap> = Optional<
  IValueFns<K>,
  "_or" | "_and" | "_string"
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
        const sort = args._cmp(a, b, true);
        return sort === Cmp.Equal ? [a] : sort < Cmp.Equal ? [a, b] : [b, a];
      }),
    _and: args._and ?? ((a, b) => (args._cmp(a, b, true) === 0 ? [a] : [])),
    _cmp: args._cmp,
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
    cmp(a, b, sortOnly = false) {
      if (a === null && b === null) return Cmp.Equal;
      if (a === null) return Cmp.Superset;
      if (b === null) return Cmp.Subset;
      return fns._cmp(a as NonNull, b as NonNull, sortOnly);
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
  string: () => "null"
}));

export const BooleanFns = unitFns("boolean", () => ({
  // promote true | false to boolean
  or(a, b) {
    if (a === null || b === null || (a && !b) || (b && !a)) return [null];
    return [a && b];
  },
  _cmp: (a: boolean, b: boolean) =>
    a === b ? Cmp.Equal : a < b ? Cmp.DisjointLt : Cmp.DisjointGt
}));

export const NumberFns = unitFns("number", () => ({
  _cmp: (a: number, b: number) =>
    a === b ? Cmp.Equal : a < b ? Cmp.DisjointLt : Cmp.DisjointGt
}));

export const StringFns = unitFns("string", () => ({
  _cmp: (a: string, b: string) => {
    const cmp = a.localeCompare(b);
    return cmp === 0 ? Cmp.Equal : cmp < 0 ? Cmp.DisjointLt : Cmp.DisjointGt;
  }
}));

export const DateFns = unitFns("date", () => ({
  _cmp: (a: L.DateTime, b: L.DateTime) => {
    const cmp = a.toMillis() - b.toMillis();
    return cmp === 0 ? Cmp.Equal : cmp < 0 ? Cmp.DisjointLt : Cmp.DisjointGt;
  }
}));

export const DurationFns = unitFns("duration", () => ({
  _cmp: (a: L.Duration, b: L.Duration) => {
    const cmp = a.toMillis() - b.toMillis();
    return cmp === 0 ? Cmp.Equal : cmp < 0 ? Cmp.DisjointLt : Cmp.DisjointGt;
  }
}));

export const ArrayFns = baseFns<"array">(() => {
  const get = <T = never>(
    obj: ITypeMap["array"],
    key: number,
    never: T = null as T
  ): IType | T => {
    if (key in obj.known) return obj.known[key];
    if (obj.unknown[0] === "never") return never;
    return TypeFns.or(obj.unknown, [["null", null]]);
  };

  const cmp = (
    as: ITypeMap["array"],
    bs: ITypeMap["array"],
    sortOnly = false
  ): Cmp => {
    const len = Math.max(as.known.length, bs.known.length);
    let res: Cmp = Cmp.Equal;

    for (let i = 0; i < len; i++) {
      const a = get(as, i, null);
      if (a === null) return UtilFns.cmpJoin(res, Cmp.Subset);

      const b = get(bs, i, null);
      if (b === null) return UtilFns.cmpJoin(res, Cmp.Superset);

      const cmp = TypeFns.cmp(a, b, sortOnly);
      if (sortOnly && cmp !== Cmp.Equal) return cmp;

      res = UtilFns.cmpJoin(res, cmp);
      if (UtilFns.isDisjoint(res)) return res;
    }

    return UtilFns.cmpJoin(res, TypeFns.cmp(as.unknown, bs.unknown, sortOnly));
  };

  return {
    or(as, bs) {
      const unknown = TypeFns.or(as.unknown, bs.unknown);
      const known: IType[] = [];
      const len = Math.max(as.known.length, bs.known.length);

      for (let i = 0; i < len; i++) {
        known.push(TypeFns.or(get(as, i, ["never"]), get(bs, i, ["never"])));
      }

      return [{ known, unknown }];
    },
    and(as, bs) {
      const known: IType[] = [];
      const len = Math.max(as.known.length, bs.known.length);

      for (let i = 0; i < len; i++) {
        const a = get(as, i, null);
        if (a === null) return [];

        const b = get(bs, i, null);
        if (b === null) return [];

        const val = TypeFns.and(a, b);
        if (val[0] === "never") return [];

        known.push(val);
      }

      const unknown = TypeFns.and(as.unknown, bs.unknown);

      return [{ known, unknown }];
    },
    cmp,
    string(value) {
      const strs = value.known.map(TypeFns.string);
      if (value.unknown[0] !== "never") {
        strs.push(`of ${TypeFns.string(value.unknown)}`);
      }
      return `[${strs.join(", ")}]`;
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
