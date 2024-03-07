/* eslint-disable @typescript-eslint/unbound-method */
import * as L from "luxon";

import type * as Stubs from "./stubs";
import * as UtilFns from "./util";
import { Cmp } from "./util";

export type IKey = keyof ITypeMap;

export interface ITypeMap {
  any: null;
  never: null | string;
  array: {
    known: Array<Type<IKey>>;
    unknown: Type<IKey>;
  };
  boolean: null | boolean;
  date: null | L.DateTime;
  duration: null | L.Duration;
  function: (...args: Array<SingleType<IKey>>) => Type<IKey>;
  link: Stubs.Link;
  null: null;
  number: null | number;
  object: {
    known: Map<string, Type<IKey>>;
    unknown: Type<IKey>;
  };
  string: null | string;
  widget: Stubs.Widget;
}
export type IType<K extends IKey = IKey> = [IVal<K>, ...Array<IVal<K>>];
export type ISingleType<K extends IKey = IKey> = [ISingleVal<K>];
export type IVal<K extends IKey = IKey> = {
  [V in K]: { type: V; values: IValues<V> };
}[K];
export type ISingleVal<K extends IKey = IKey> = {
  [V in K]: { type: V; values: ISingleValues<V> };
}[K];
export type IValues<K extends IKey = IKey> = [
  ITypeMap[K],
  ...Array<ITypeMap[K]>
];
export type ISingleValues<K extends IKey = IKey> = [ITypeMap[K]];

const $isType = Symbol("type");
export const isType = (obj: object): obj is Type => $isType in obj;

export interface TypeBase<K extends IKey> {
  [$isType]: true;
  get type(): K;
  get value(): ITypeMap[K];
  or: (other: Type<any>) => Type;
  and: (other: Type<any>) => Type;
  cmp: (other: Type<any>, sortOnly?: boolean) => Cmp;
  toString: () => string;
  isSingle: () => this is SingleType<K>;
  isType: () => boolean;
  splitTypes: () => Iterable<SingleType<K>>;
}

export interface Type<K extends IKey = IKey> extends TypeBase<K> {
  types: IType<K>;
  get values(): Array<ITypeMap[K]>;
  clone: () => Type<K>;
}

export interface SingleType<K extends IKey = IKey> extends TypeBase<K> {
  types: ISingleType<K>;
  get values(): [ITypeMap[K]];
  clone: () => SingleType<K>;
}

export const type: {
  <K extends IKey>(types: IType<K>): Type<K>;
  <K extends IKey, T>(types: IType<K>, self: T): Type<K> & T;
} = <K extends IKey, T>(types: IType<K>, self?: T): Type<K> | (Type<K> & T) => {
  const obj = (self ?? {}) as Type<any>;
  obj[$isType] = true;
  obj.types = types;
  Object.defineProperty(obj, "type", { get: () => obj.types[0].type });
  Object.defineProperty(obj, "values", { get: () => obj.types[0].values });
  Object.defineProperty(obj, "value", { get: () => obj.types[0].values[0] });
  obj.or = (other) => type(TypeFns.or(obj.types, other.types));
  obj.and = (other) => type(TypeFns.and(obj.types, other.types));
  obj.cmp = (other, sortOnly = false) =>
    TypeFns.cmp(obj.types, other.types, sortOnly);
  obj.toString = () => TypeFns.string(obj.types);
  obj.isSingle = () => TypeFns.isSingle(obj.types);
  obj.isType = () => TypeFns.isType(obj.types);
  obj.splitTypes = () =>
    UtilFns.map(TypeFns.splitTypes(obj.types), type) as Array<SingleType<K>>;
  obj.clone = () => type(TypeFns.clone(obj.types));
  return obj;
};

export const val = <K extends IKey>(
  key: K,
  value: ITypeMap[K]
): ISingleType<K> => [{ type: key, values: [value] }];

export const singleType: {
  <K extends IKey>(key: K, value: ITypeMap[K]): SingleType<K>;
  <K extends IKey, T>(key: K, value: ITypeMap[K], self: T): SingleType<K> & T;
} = <K extends IKey, T>(
  key: K,
  value: ITypeMap[K],
  self?: T
): SingleType<K> | (SingleType<K> & T) => type(val(key, value), self as any);

export const callable = <T extends { $: (...args: any[]) => any }>(
  obj: T
): T["$"] & Omit<T, "$"> => {
  const fn = obj.$ as T["$"] & Omit<T, "$">;
  delete (obj as any).$;

  for (const key of Object.keys(obj) as Array<keyof Omit<T, "$">>) {
    fn[key] = obj[key] as any;
  }

  return fn;
};

export const TypeFns = {
  or(as: IType, bs: IType): IType {
    // short circuit on identity
    if (as === bs) return as;

    const a = as[0];
    const b = bs[0];

    // any
    if (a.type === "any") return as;
    if (b.type === "any") return bs;

    // never
    if (a.type === "never") return bs;
    if (b.type === "never") return as;

    // vals
    return [...UtilFns.or<IVal>(as, bs, ValFns.or)] as IType;
  },
  and(as: IType, bs: IType): IType {
    // short circuit on identity
    if (as === bs) return as;

    const a = as[0];
    const b = bs[0];

    // any
    if (a.type === "any") return bs;
    if (b.type === "any") return as;

    // never
    if (a.type === "never") return as;
    if (b.type === "never") return bs;

    // vals
    const res = [...UtilFns.and<IVal>(as, bs, ValFns.and, ValFns.cmp)];
    return res.length === 0
      ? [{ type: "never", values: [NeverFns.error(as, bs)] }]
      : (res as IType);
  },
  cmp(as: IType, bs: IType, sortOnly = false): Cmp {
    // short circuit on identity
    if (as === bs) return Cmp.Equal;

    const a = as[0];
    const b = bs[0];

    // any
    if (a.type === "any") return Cmp.Superset;
    if (b.type === "any") return Cmp.Subset;

    // never
    if (a.type === "never") return Cmp.Subset;
    if (b.type === "never") return Cmp.Superset;

    // vals
    return UtilFns.cmp(as, bs, ValFns.cmp, sortOnly);
  },
  string: (types: IType) =>
    types
      .flatMap((t) => t.values.map((v) => getFns(t.type).string(v)))
      .join(" or "),
  isSingle(types: IType): boolean {
    if (types.length > 1) return false;
    for (const t of types) {
      const { isSingle } = getFns(t.type);
      for (const v of t.values) {
        if (!isSingle(v)) return false;
      }
    }
    return true;
  },
  isType(types: IType): boolean {
    if (types.length > 1) return true;
    for (const t of types) {
      const { isType } = getFns(t.type);
      for (const v of t.values) {
        if (isType(v)) return true;
      }
    }
    return false;
  },
  *splitTypes(types: IType): Iterable<ISingleType> {
    for (const t of types) {
      const { splitTypes } = getFns(t.type);
      for (const v of t.values) {
        for (const single of splitTypes(v) as Iterable<ITypeMap[IKey]>) {
          yield val(t.type, single);
        }
      }
    }
  },
  clone(types: IType): IType {
    return [
      ...types.map((t) => {
        const { clone } = getFns(t.type);
        return {
          type: t.type,
          values: [...t.values.map(clone)]
        };
      })
    ] as IType;
  }
};

export const ValFns = {
  or(a: IVal, b: IVal): [IVal] | [IVal, IVal] {
    if (a.type !== b.type) {
      return StringFns._cmp(a.type, b.type) < 0 ? [a, b] : [b, a];
    }

    return [
      {
        type: a.type,
        values: [...UtilFns.or(a.values, b.values, getFns(a.type).or)]
      }
    ] as [IVal];
  },
  and(a: IVal, b: IVal): [] | [IVal] {
    if (a.type !== b.type) return [];

    const { and, cmp } = getFns(a.type);
    const values = [...UtilFns.and(a.values, b.values, and, cmp)];
    if (values.length === 0) return [];

    return [{ type: a.type, values }] as [IVal];
  },
  cmp(a: IVal, b: IVal, sortOnly = false): Cmp {
    const cmpVal = StringFns._cmp(a.type, b.type, sortOnly);
    return UtilFns.cmp(
      a.values,
      b.values,
      getFns(a.type).cmp,
      sortOnly,
      cmpVal
    );
  }
};

interface IFnsType<T> {
  or: (a: T, b: T) => [T] | [T, T];
  and: (a: T, b: T) => [] | [T];
  cmp: (a: T, b: T, sortOnly?: boolean) => Cmp;
  string: (value: T) => string;
  isSingle: (value: T) => boolean;
  isType: (value: T) => boolean;
  splitTypes: (value: T) => Iterable<T>;
  clone: (value: T) => T;
}

type IFns<K extends IKey> = IFnsType<ITypeMap[K]>;

const baseFns = <K extends IKey>(fn: () => IFns<K>): IFns<K> => fn();

type INonNullFn<K extends IKey, Fn extends keyof IFnsType<K>> = IFnsType<
  Exclude<ITypeMap[K], null>
>[Fn];

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

interface IUnitFns<K extends IKey> {
  _or: INonNullFn<K, "or">;
  _and: INonNullFn<K, "and">;
  _cmp: INonNullFn<K, "cmp">;
  _string: INonNullFn<K, "string">;
  _clone: INonNullFn<K, "clone">;
}
type IUnitFnsArgs<K extends IKey> = Optional<
  IUnitFns<K>,
  "_or" | "_and" | "_string" | "_clone"
>;

const unitFns = <K extends IKey, T>(
  key: K,
  argsFn: () => Partial<IFns<K>> & IUnitFnsArgs<K> & T
): IFns<K> & IUnitFns<K> & T => {
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
    _string: args._string ?? JSON.stringify,
    _clone: args._clone ?? ((v) => v)
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
    string: (value) => (value === null ? key : fns._string(value)),
    isSingle: () => true,
    isType: (value) => value === null,
    splitTypes: (value) => [value],
    clone: (value) => (value === null ? null : fns._clone(value as NonNull)),
    ...fns
  };
};

export const AnyFns = baseFns<"any">(() => ({
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  string: () => "any",
  isSingle: () => true,
  isType: () => true,
  splitTypes: () => [null],
  clone: () => null
}));

export const NeverFns = unitFns("never", () => ({
  _cmp: (a, b, sortOnly) => StringFns._cmp(a, b, sortOnly),
  _string: (msg) => `error(${JSON.stringify(msg)})`,
  isType: () => true,
  error(a: IType, b: IType): string {
    return `Can't combine '${TypeFns.string(a)}' and '${TypeFns.string(b)}'.`;
  }
}));

export const NullFns = baseFns<"null">(() => ({
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  string: () => "null",
  isSingle: () => true,
  isType: () => false,
  splitTypes: () => [null],
  clone: () => null
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
  },
  _clone: (v) => L.DateTime.fromMillis(v.toMillis())
}));

export const DurationFns = unitFns("duration", () => ({
  _cmp: (a: L.Duration, b: L.Duration) => {
    const cmp = a.toMillis() - b.toMillis();
    return cmp === 0 ? Cmp.Equal : cmp < 0 ? Cmp.DisjointLt : Cmp.DisjointGt;
  },
  _clone: (v) => L.Duration.fromMillis(v.toMillis())
}));

export const LinkFns = unitFns("link", () => ({
  _cmp: (_a, _b) => {
    throw new Error("TODO");
  }
}));

export const WidgetFns = unitFns("widget", () => ({
  _cmp: (_a, _b) => {
    throw new Error("TODO");
  }
}));

type IColKeyVal<K extends "array" | "object"> = K extends "array"
  ? number
  : string;
type IColKnown<K extends "array" | "object"> = ITypeMap[K]["known"];
interface ICollectionFnsArgs<K extends "array" | "object"> {
  _get: <T>(obj: IColKnown<K>, key: IColKeyVal<K>, never: T) => Type | T;
  _keysOr: (
    a: IColKeyVal<K>,
    b: IColKeyVal<K>
  ) => [IColKeyVal<K>] | [IColKeyVal<K>, IColKeyVal<K>];
  _size: (obj: IColKnown<K>) => number;
  _unionKeys?: (as: IColKnown<K>, bs: IColKnown<K>) => Iterable<IColKeyVal<K>>;
  _new: (iter?: Iterable<[IColKeyVal<K>, Type]>) => IColKnown<K>;
  _stringKey: (key: IColKeyVal<K>) => string;
  _stringWrap: [string, string];
}

interface ICollectionFns<K extends "array" | "object"> {
  size: (obj: ITypeMap[K]) => number;
  knownSize: (obj: ITypeMap[K]) => number;
  get: (obj: ITypeMap[K], key: IColKeyVal<K>) => Type;
}

export const collectionFns = <K extends "array" | "object", V>(
  key: K,
  argsFn: () => ICollectionFnsArgs<K>,
  extendFns: () => V = () => ({}) as V
): IFns<K> & ICollectionFns<K> & V => {
  type IColKeyVals = Iterable<IColKeyVal<K>>;
  const args = argsFn();

  const _get = <T = never>(
    obj: ITypeMap[K],
    key: IColKeyVal<K>,
    never: T = null as T
  ): Type | T => {
    const val = args._get(obj.known, key, never);
    if (val !== never) return val;
    if (obj.unknown.type === "never") return never;
    return obj.unknown.or($null);
  };

  const cmp = (as: ITypeMap[K], bs: ITypeMap[K], sortOnly = false): Cmp => {
    let res: Cmp = Cmp.Equal;

    for (const key of unionKeys(as.known, bs.known)) {
      const a = _get(as, key, null);
      if (a === null) return UtilFns.cmpJoin(res, Cmp.Subset);

      const b = _get(bs, key, null);
      if (b === null) return UtilFns.cmpJoin(res, Cmp.Superset);

      const cmp = a.cmp(b, sortOnly);
      if (sortOnly && cmp !== Cmp.Equal) return cmp;

      res = UtilFns.cmpJoin(res, cmp);
      if (UtilFns.isDisjoint(res)) return res;
    }

    return UtilFns.cmpJoin(res, as.unknown.cmp(bs.unknown, sortOnly));
  };

  const unionKeys =
    args._unionKeys ??
    ((as, bs) =>
      UtilFns.or(
        [...(as.keys() as IColKeyVals)],
        [...(bs.keys() as IColKeyVals)],
        args._keysOr
      ));

  function* unionVals(
    as: ITypeMap[K],
    bs: ITypeMap[K]
  ): Iterable<[IColKeyVal<K>, Type]> {
    for (const key of unionKeys(as.known, bs.known)) {
      yield [key, _get(as, key, $never).or(_get(bs, key, $never))];
    }
  }

  return {
    or(as, bs) {
      const unknown = as.unknown.or(bs.unknown);
      const known = args._new(unionVals(as, bs));
      return [{ known, unknown }] as [ITypeMap[K]];
    },
    and(as, bs) {
      const res: Array<[IColKeyVal<K>, Type]> = [];

      for (const key of unionKeys(as.known, bs.known)) {
        const a = _get(as, key, null);
        if (a === null) return [];

        const b = _get(bs, key, null);
        if (b === null) return [];

        const val = a.and(b);
        if (val.type === "never") return [];

        res.push([key, val]);
      }

      const known = args._new(res.values());
      const unknown = as.unknown.and(bs.unknown);
      return [{ known, unknown }] as [ITypeMap[K]];
    },
    cmp,
    string(obj) {
      const strs: string[] = [];
      for (const key of obj.known.keys() as IColKeyVals) {
        const value: Type = _get(obj, key, $never);
        strs.push(`${args._stringKey(key)}${value.toString()}`);
      }
      if (obj.unknown.type !== "never") {
        strs.push(`of ${obj.unknown.toString()}`);
      }
      return `${args._stringWrap[0]}${strs.join(", ")}${args._stringWrap[1]}`;
    },
    get(obj, key) {
      return _get(obj, key, $never);
    },
    size(obj) {
      return obj.unknown.type === "never" ? args._size(obj.known) : Infinity;
    },
    knownSize(obj) {
      return args._size(obj.known);
    },
    isSingle(obj) {
      for (const key of obj.known.keys() as IColKeyVals) {
        const val = args._get(obj.known, key, null as never);
        if (!val.isSingle()) return false;
      }
      return true;
    },
    isType(obj) {
      if (obj.unknown.type !== "never") return true;
      for (const key of obj.known.keys() as IColKeyVals) {
        const val = args._get(obj.known, key, null as never);
        if (val.isType()) return true;
      }
      return false;
    },
    *splitTypes(obj): Iterable<ITypeMap[K]> {
      // combos[0] => Iterable<Type>
      // combos.slice(1) => Iterable<[IColKeyVal<K>, Type]>
      const combos: Array<Iterable<unknown>> = [obj.unknown.splitTypes()];

      for (const key of obj.known.keys() as IColKeyVals) {
        combos.push(UtilFns.map(_get(obj, key).splitTypes(), (v) => [key, v]));
      }

      for (const obj of UtilFns.cartesian(combos)) {
        const unknown = obj[0] as Type;
        const knownVals = obj.slice(1) as Array<[IColKeyVal<K>, Type]>;
        const known = args._new(knownVals) as any; // IColKnown<K>
        yield { known, unknown };
      }
    },
    clone(obj): ITypeMap[K] {
      const unknown = obj.unknown.clone();
      const knownVals: Array<[any, Type]> = [];

      for (const key of obj.known.keys() as IColKeyVals) {
        knownVals.push([key, _get(obj, key).clone()]);
      }

      const known = args._new(knownVals);
      return { known, unknown } as ITypeMap[K];
    },
    ...extendFns()
  };
};

export const ArrayFns = collectionFns("array", () => ({
  _get: (obj, key, never) => obj[key] ?? never,
  _keysOr: NumberFns._or,
  _unionKeys: (as, bs) => (as.length < bs.length ? bs : as).keys(),
  _size: (obj) => obj.length,
  _new: (iter) =>
    iter === undefined ? [] : [...UtilFns.map(iter, (val) => val[1])],
  _stringKey: () => "",
  _stringWrap: ["[", "]"]
}));

export const ObjectFns = collectionFns("object", () => ({
  _get: (obj, key, never) => obj.get(key) ?? never,
  _keysOr: StringFns._or,
  _size: (obj) => obj.size,
  _new: (iter) => (iter === undefined ? new Map() : new Map(iter)),
  _stringKey: (key) => `${key}: `,
  _stringWrap: ["{ ", " }"]
}));

export const FunctionFns = baseFns<"function">(() => {
  const cmp = (a: ITypeMap["function"], b: ITypeMap["function"]): Cmp =>
    a === b ? Cmp.Equal : a < b ? Cmp.DisjointLt : Cmp.DisjointGt;

  return {
    or: (a, b) => {
      const cmpVal = cmp(a, b);
      return cmpVal === Cmp.Equal ? [a] : cmpVal < Cmp.Equal ? [a, b] : [b, a];
    },
    and: (a, b) => (cmp(a, b) === Cmp.Equal ? [a] : []),
    cmp,
    string: () => "<function>",
    isSingle: () => true,
    isType: () => false,
    splitTypes: (val) => [val],
    clone: (fn) => fn.bind({})
  };
});

type IFn<T> = (...args: T[]) => Type;
type IArgs = Type[] | [...Type[], IOptional];
type IOptional = Type[] | [...Type[], IVararg];
type IVararg = [Type];

interface IFnDec<T> {
  (args: IArgs, fn: IFn<Type<any>>): T;
  (args: IArgs, type: Type, valufy: number[], valFn: IFn<any>): T;
}

interface IFnBuilder {
  add: IFnDec<IFnBuilder>;
  build: () => SingleType<"function">;
}

export const define = (name: string, vectorize: number[]): IFnBuilder => {
  const fns: Array<{
    types: Type<"array">;
    fn: IFn<Type>;
  }> = [];

  // utility
  const splitArgs = (
    args: IArgs
  ): { required: Type[]; optional: Type[]; vararg: Type | null } => {
    const res = {
      required: args as Type[],
      optional: [] as Type[],
      vararg: null as Type | null
    };

    const optional = args.at(-1) ?? [];
    if (isType(optional)) return res;
    res.required = args.slice(0, -1) as Type[];

    const vararg = optional.at(-1) ?? [null];
    if (isType(vararg)) return res;
    res.optional = optional.slice(0, -1) as Type[];
    res.vararg = vararg[0];

    return res;
  };

  const valufyFn =
    (def: Type, valufy: number[], fn: IFn<any>): IFn<Type> =>
    (...args: Type[]): Type => {
      for (const pos of valufy.filter((pos) => pos < args.length)) {
        const arg = args[pos];
        if (arg.isType()) return def;
        args[pos] = arg.value as any;
      }
      return fn(...args);
    };

  const vectorizeFn =
    (fn: IFn<Type>): IFn<Type> =>
    (...args: Type[]): Type => {
      const vecMap = new Map<number, Type<"array">>();

      for (const pos of vectorize) {
        const arg = args[pos];
        if (arg.type !== "array" || pos >= args.length) continue;
        vecMap.set(pos, arg as Type<"array">);
      }

      const vecs = [...vecMap.values()].map((t) => t.value);
      if (vecs.length === 0) return fn(...args);

      const maxOrInfinity = Math.min(...vecs.map(ArrayFns.size));
      const min = Math.min(...vecs.map(ArrayFns.knownSize));
      const max =
        maxOrInfinity !== Infinity
          ? maxOrInfinity
          : Math.max(...vecs.map(ArrayFns.knownSize));

      let $res = $array([]);
      const results: Array<Type<"array">> = min === 0 ? [$res] : [];

      for (let subPos = 0; subPos < max; subPos++) {
        const subArgs: Type[] = [...args];

        for (const [vecPos, $vecArg] of vecMap.entries()) {
          subArgs[vecPos] = ArrayFns.get($vecArg.value, subPos);
        }

        $res = $res.clone();
        $res.value.known.push(fn(...subArgs));

        if (subPos + 1 >= min) {
          results.push($res);
        }
      }

      if (maxOrInfinity === Infinity) {
        const lastPos = results.length - 1;
        const last = results[lastPos];
        const subArgs = [...args];

        for (const [vecPos, vecArg] of vecMap.entries()) {
          subArgs[vecPos] = vecArg.value.known[max] ?? vecArg.value.unknown;
        }

        results[lastPos] = $array(last.value.known, fn(...subArgs));
      }

      return results.reduce<Type>((a, b) => a.or(b), $never);
    };

  const add: IFnBuilder["add"] = (
    args: IArgs,
    typeOrFn: Type | IFn<Type>,
    valufy?: number[],
    valFn?: IFn<any>
  ): IFnBuilder => {
    const { required, optional, vararg } = splitArgs(args);
    const argList = [...required, ...optional];

    // vectorized types
    for (const pos of vectorize.filter((pos) => pos < argList.length)) {
      const arg = argList[pos];
      argList[pos] = arg.or($array([], arg));
    }

    // optional types
    for (let pos = required.length; pos < argList.length; pos++) {
      const arg = argList[pos];
      argList[pos] = arg.or($null);
    }

    // vararg types
    const types = $array(argList, vararg ?? $never);

    // valufy function
    let fn =
      typeof typeOrFn === "function"
        ? typeOrFn
        : valufyFn(typeOrFn, valufy!, valFn!);

    // vectorize function
    fn = vectorizeFn(fn);

    // add final result
    fns.push({ types, fn });

    return { add, build };
  };

  const build: IFnBuilder["build"] = () =>
    singleType("function", (...args: SingleType[]): Type => {
      // propagate errors
      const errors = args.filter((arg) => arg.type === "never");

      if (errors.length > 0) {
        return errors.reduce<Type>((a, b) => a.or(b), $never);
      }

      // finds match
      const argList = $array(args);
      let matchFn: IFn<SingleType> | null = null;

      for (const { types, fn } of fns) {
        const cmp = argList.cmp(types);
        if (cmp === Cmp.Equal || cmp === Cmp.Subset) {
          matchFn = fn;
          break;
        }
      }

      // throws error if none found
      if (matchFn === null) {
        return $never(
          `No implementation of '${name}' found for arguments: ${args
            .map((arg) => arg.toString())
            .join(", ")}`
        );
      }

      // union all results
      const combos = args.map((arg) => arg.splitTypes());
      let res: Type = $never;

      for (const combo of UtilFns.cartesian(combos)) {
        res = res.or(matchFn(...combo));
      }

      return res;
    });

  return { add, build };
};

export const Fns = {
  any: AnyFns,
  never: NeverFns,
  array: ArrayFns,
  boolean: BooleanFns,
  date: DateFns,
  duration: DurationFns,
  function: FunctionFns,
  link: LinkFns,
  null: NullFns,
  number: NumberFns,
  object: ObjectFns,
  string: StringFns,
  widget: WidgetFns
};

const getFns = <K extends keyof typeof Fns>(key: K): IFnsType<unknown> =>
  Fns[key] as IFnsType<unknown>;

export const $any = singleType("any", null);

export const $never = singleType(
  "never",
  null,
  callable({
    $: (msg: string) => singleType("never", msg),
    andError: (a: Type, b: Type) => $never(NeverFns.error(a.types, b.types))
  })
);

export const $array = singleType(
  "array",
  { known: [], unknown: $any },
  <K extends Type, U extends Type>(known: K[], unknown?: U) =>
    singleType("array", { known, unknown: unknown ?? $never })
);

export const $boolean = singleType("boolean", null, (value: boolean) =>
  singleType("boolean", value)
);

export const $true = $boolean(true);
export const $false = $boolean(false);

export const $date = singleType("date", null, (date: L.DateTime) =>
  singleType("date", date)
);

export const $duration = singleType("duration", null, (duration: L.Duration) =>
  singleType("duration", duration)
);

export const $function = singleType<"function", IFnDec<Type>>(
  "function",
  () => $any,
  (...args: [any, any]) =>
    define("<lambda>", [])
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .add(...args)
      .build()
);

export const $link = (() => {
  throw new Error("TODO");
}) as unknown as SingleType<"link">;

export const $null = singleType("null", null);

export const $number = singleType("number", null, (value: number) =>
  singleType("number", value)
);

export const $object = singleType(
  "object",
  { known: new Map(), unknown: $any },
  (known: Record<string, Type>, unknown?: Type) => {
    const knownVals = new Map<string, Type>();

    for (const key of Object.keys(known).sort(StringFns._cmp)) {
      knownVals.set(key, known[key]);
    }

    return singleType("object", {
      known: knownVals,
      unknown: unknown ?? $never
    });
  }
);

export const $string = singleType("string", null, (value: string) =>
  singleType("string", value)
);

export const $widget = (() => {
  throw new Error("TODO");
}) as unknown as SingleType<"widget">;
