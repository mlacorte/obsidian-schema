/* eslint-disable @typescript-eslint/unbound-method */
import type * as L from "luxon";

import type * as Stubs from "./stubs";
import * as UtilFns from "./util";
import { Cmp } from "./util";

export interface ITypeMap {
  any: null;
  never: null | string;
  array: { known: Type[]; unknown: Type };
  boolean: null | boolean;
  date: null | L.DateTime;
  duration: null | L.Duration;
  function: (...args: Type[]) => Type;
  link: Stubs.Link;
  null: null;
  number: null | number;
  object: { known: Map<string, Type>; unknown: Type };
  string: null | string;
  widget: Stubs.Widget;
}
export type IType<K extends keyof ITypeMap = keyof ITypeMap> = [
  IVal<K>,
  ...Array<IVal<K>>
];
export type IVal<K extends keyof ITypeMap = keyof ITypeMap> = {
  [V in K]: { type: V; values: IValues<V> };
}[K];
export type IValues<K extends keyof ITypeMap = keyof ITypeMap> = [
  ITypeMap[K],
  ...Array<ITypeMap[K]>
];

const $isType = Symbol("type");
export const isType = (obj: object): obj is Type => $isType in obj;

export interface Type<K extends keyof ITypeMap = keyof ITypeMap> {
  [$isType]: true;
  types: IType<K>;
  get type(): K;
  get value(): ITypeMap[K];
  get values(): Array<ITypeMap[K]>;
  or: (other: Type) => Type;
  and: (other: Type) => Type;
  cmp: (other: Type, sortOnly?: boolean) => Cmp;
  toString: () => string;
  isType: () => boolean;
  splitTypes: () => Iterable<Type>;
}

export const type: {
  <K extends keyof ITypeMap>(types: IType<K>): Type<K>;
  <K extends keyof ITypeMap, T>(types: IType<K>, self: T): Type<K> & T;
} = <K extends keyof ITypeMap, T>(
  types: IType<K>,
  self?: T
): Type<K> | (Type & T) => {
  const res = (self ?? {}) as unknown as Type<any>;
  res[$isType] = true;
  res.types = types as any;
  Object.defineProperty(res, "type", { get: () => res.types[0].type });
  Object.defineProperty(res, "value", { get: () => res.types[0].values[0] });
  Object.defineProperty(res, "values", { get: () => res.types[0].values });
  res.or = (other) => type(TypeFns.or(res.types, other.types));
  res.and = (other) => type(TypeFns.and(res.types, other.types));
  res.cmp = (other, sortOnly = false) =>
    TypeFns.cmp(res.types, other.types, sortOnly);
  res.toString = () => TypeFns.string(res.types);
  res.isType = () => TypeFns.isType(res.types);
  res.splitTypes = () => UtilFns.map(TypeFns.splitTypes(res.types), type);
  return res;
};

export const val = <K extends keyof ITypeMap>(
  key: K,
  value: ITypeMap[K]
): IType<K> => [{ type: key, values: [value] }] as IType<K>;

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

export const clone = <K extends keyof ITypeMap>(self: Type<K>): Type<K> =>
  type(structuredClone(self.types));

export const TypeFns = {
  or(as: IType, bs: IType): IType {
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
  string: (values: IType) =>
    values
      .flatMap((val) => val.values.map((v) => getFns(val.type).string(v)))
      .join(" or "),
  isType(values: IType): boolean {
    if (values.length > 0) return true;
    for (const val of values) {
      if (ValFns.isType(val)) return true;
    }
    return false;
  },
  *splitTypes(values: IType): Iterable<IType> {
    for (const val of values) {
      for (const res of ValFns.splitTypes(val)) {
        yield res;
      }
    }
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
  },
  string: (value: IVal) => getFns(value.type).string(value.values),
  isType: (value: IVal) => getFns(value.type).isType(value.values),
  splitTypes: (value: IVal) =>
    getFns(value.type).splitTypes(value.values) as Iterable<IType>
};

interface IFnsType<T> {
  or: (a: T, b: T) => [T] | [T, T];
  and: (a: T, b: T) => [] | [T];
  cmp: (a: T, b: T, sortOnly?: boolean) => Cmp;
  string: (value: T) => string;
  isType: (value: T) => boolean;
  splitTypes: (value: T) => Iterable<T>;
}

type IFns<K extends keyof ITypeMap> = IFnsType<ITypeMap[K]>;

const baseFns = <K extends keyof ITypeMap>(fn: () => IFns<K>): IFns<K> => fn();

type INonNullFn<
  K extends keyof ITypeMap,
  Fn extends keyof IFnsType<K>
> = IFnsType<Exclude<ITypeMap[K], null>>[Fn];

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

interface IUnitFns<K extends keyof ITypeMap> {
  _or: INonNullFn<K, "or">;
  _and: INonNullFn<K, "and">;
  _cmp: INonNullFn<K, "cmp">;
  _string: INonNullFn<K, "string">;
}
type IUntFnsArgs<K extends keyof ITypeMap> = Optional<
  IUnitFns<K>,
  "_or" | "_and" | "_string"
>;

const unitFns = <K extends keyof ITypeMap, T>(
  key: K,
  argsFn: () => Partial<IFns<K>> & IUntFnsArgs<K> & T
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
    isType(value) {
      return value === null;
    },
    splitTypes(value) {
      return [value];
    },
    ...fns
  };
};

export const AnyFns = baseFns<"any">(() => ({
  or: () => [null],
  and: () => [null],
  cmp: () => Cmp.Equal,
  string: () => "any",
  isType: () => true,
  splitTypes: () => [null].values()
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
  isType: () => false,
  splitTypes: () => [null].values()
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

type IKey<K extends "array" | "object"> = K extends "array" ? number : string;
type IKnown<K extends "array" | "object"> = ITypeMap[K]["known"];
interface ICollectionFnsArgs<K extends "array" | "object"> {
  _get: <T>(obj: IKnown<K>, key: IKey<K>, never: T) => Type | T;
  _keysOr: (a: IKey<K>, b: IKey<K>) => [IKey<K>] | [IKey<K>, IKey<K>];
  _size: (obj: IKnown<K>) => number;
  _unionKeys?: (as: IKnown<K>, bs: IKnown<K>) => Iterable<IKey<K>>;
  _new: (iter?: Iterable<[IKey<K>, Type]>) => IKnown<K>;
  _stringKey: (key: IKey<K>) => string;
  _stringWrap: [string, string];
}

interface ICollectionFns<K extends "array" | "object"> {
  size: (obj: ITypeMap[K]) => number;
  knownSize: (obj: ITypeMap[K]) => number;
  get: (obj: ITypeMap[K], key: IKey<K>) => Type;
}

export const collectionFns = <K extends "array" | "object", V>(
  key: K,
  argsFn: () => ICollectionFnsArgs<K>,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  extendFns: () => V = () => ({}) as V
): IFns<K> & ICollectionFns<K> & V => {
  type IKeys = Iterable<IKey<K>>;
  const args = argsFn();

  const _get = <T = never>(
    obj: ITypeMap[K],
    key: IKey<K>,
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
        [...(as.keys() as IKeys)],
        [...(bs.keys() as IKeys)],
        args._keysOr
      ));

  function* unionVals(
    as: ITypeMap[K],
    bs: ITypeMap[K]
  ): Iterable<[IKey<K>, Type]> {
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
      const res: Array<[IKey<K>, Type]> = [];

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
      for (const key of obj.known.keys() as IKeys) {
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
    isType(obj) {
      if (obj.unknown.type !== "never") return true;
      for (const key of obj.known.keys() as IKeys) {
        const val = args._get(obj.known, key, null as never);
        if (val.isType()) return true;
      }
      return false;
    },
    *splitTypes(obj): Iterable<ITypeMap[K]> {
      const combos: Array<Iterable<any>> = [obj.unknown.splitTypes()];

      for (const key of obj.known.keys() as IKeys) {
        combos.push(
          UtilFns.map(_get(obj, key).splitTypes(), (val) => [key, val])
        );
      }

      for (const [unknown, ...known] of UtilFns.cartesian(combos)) {
        const res = { known: args._new(known), unknown };
        yield res as ITypeMap[K];
      }
    },
    ...extendFns()
  };
};

export const ArrayFns = collectionFns(
  "array",
  () => ({
    _get: (obj, key, never) => obj[key] ?? never,
    _keysOr: NumberFns._or,
    _unionKeys: (as, bs) => (as.length < bs.length ? bs : as).keys(),
    _size: (obj) => obj.length,
    _new: (iter) =>
      iter === undefined ? [] : [...UtilFns.map(iter, (val) => val[1])],
    _stringKey: () => "",
    _stringWrap: ["[", "]"]
  }),
  () => ({
    new(known: Type[], unknown?: Type): IType<"array"> {
      return val("array", { known, unknown: unknown ?? $never });
    }
  })
);

export const ObjectFns = collectionFns(
  "object",
  () => ({
    _get: (obj, key, never) => obj.get(key) ?? never,
    _keysOr: StringFns._or,
    _size: (obj) => obj.size,
    _new: (iter) => (iter === undefined ? new Map() : new Map(iter)),
    _stringKey: (key) => `${key}: `,
    _stringWrap: ["{ ", " }"]
  }),
  () => ({
    new(known: Array<[string, Type]>, unknown?: Type): IType<"object"> {
      return val("object", {
        known: new Map(known),
        unknown: unknown ?? $never
      });
    }
  })
);

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
    isType: () => false,
    splitTypes: (val) => [val].values()
  };
});

type IFn<T> = (...args: T[]) => Type;
type IArgs = Type[] | [...Type[], IOptional];
type IOptional = Type[] | [...Type[], IVararg];
type IVararg = [Type];

interface IFnDec<T> {
  (args: IArgs, fn: IFn<Type>): T;
  (args: IArgs, type: Type, valufy: number[], valFn: IFn<any>): T;
}

interface IFnBuilder {
  add: IFnDec<IFnBuilder>;
  build: () => IFn<Type>;
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
        if (arg.type !== "array") continue;
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

        $res = clone($res);
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
          subArgs[vecPos] = ArrayFns.get(vecArg.value, max);
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
        : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          valufyFn(typeOrFn, valufy!, valFn!);

    // vectorize function
    fn = vectorizeFn(fn);

    // add final result
    fns.push({ types, fn });

    return { add, build };
  };

  const build: IFnBuilder["build"] =
    () =>
    (...args: Type[]): Type => {
      // propagate errors
      const errors = args.filter((arg) => arg.type === "never");

      if (errors.length > 0) {
        return errors.reduce<Type>((a, b) => a.or(b), $never);
      }

      // finds match
      const argList = $array(args);
      let matchFn: IFn<Type> | null = null;

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
    };

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

const getFns = <K extends keyof typeof Fns>(key: K): IFnsType<unknown> =>
  Fns[key] as IFnsType<unknown>;

export const $any = type(val("any", null));

export const $never = type(
  val("never", null),
  callable({
    $: (msg: string) => type(val("never", msg)),
    andError: (a: Type, b: Type) => $never(NeverFns.error(a.types, b.types))
  })
);

export const $array = type(
  ArrayFns.new([], $any),
  <K extends Type, U extends Type = typeof $never>(known: K[], unknown?: U) =>
    type(ArrayFns.new(known, unknown ?? $never))
);

export const $boolean = type(val("boolean", null), (value: boolean) =>
  type(val("boolean", value))
);

export const $true = $boolean(true);
export const $false = $boolean(false);

export const $date = type(val("date", null), (date: L.DateTime) =>
  type(val("date", date))
);

export const $duration = type(val("duration", null), (duration: L.Duration) =>
  type(val("duration", duration))
);

export const $function = type<"function", IFnDec<Type>>(
  val("function", () => $any),
  (...args: [any, any]) => {
    const res = define("<lambda>", [])
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .add(...args)
      .build();

    return type(val("function", res));
  }
);

export const $link = (() => {
  throw new Error("TODO");
}) as unknown as Type<"link">;

export const $null = type(val("null", null));

export const $number = type(val("number", null), (value: number) =>
  type(val("number", value))
);

export const $object = type(
  ObjectFns.new([], $any),
  (known: Record<string, Type>, unknown?: Type) => {
    const knownVals: Array<[string, Type]> = [];

    for (const key of Object.keys(known).sort(StringFns._cmp)) {
      knownVals.push([key, known[key]]);
    }

    return type(ObjectFns.new(knownVals, unknown));
  }
);

export const $string = type(val("string", null), (value: string) =>
  type(val("string", value))
);

export const $widget = (() => {
  throw new Error("TODO");
}) as unknown as Type<"widget">;
