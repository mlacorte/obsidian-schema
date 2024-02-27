/* eslint-disable @typescript-eslint/unbound-method */
import type * as L from "luxon";

import type * as Stubs from "./stubs";
import * as UtilFns from "./util";
import { Cmp } from "./util";

export interface ITypeMap {
  any: null;
  never: null | string;
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
export type IType = [IVal, ...IVal[]];
export type IVal = {
  [K in keyof ITypeMap]: {
    type: K;
    values: IValues<K>;
  };
}[keyof ITypeMap];
export type IValues<K extends keyof ITypeMap = keyof ITypeMap> = [
  ITypeMap[K],
  ...Array<ITypeMap[K]>
];

const $isType = Symbol("type");
export const isType = (obj: object): obj is Type => $isType in obj;

export interface Type<V = IType> {
  [$isType]: true;
  value: V;
  or: (other: Type) => Type;
  and: (other: Type) => Type;
  cmp: (other: Type) => Cmp;
  toString: () => string;
  isType: () => boolean;
}

export type ISingleType<K extends keyof ITypeMap = keyof ITypeMap> = [
  { type: K; values: [ITypeMap[K]] }
];

export type SingleType<K extends keyof ITypeMap = keyof ITypeMap> = Type<
  ISingleType<K>
>;

export const $type: {
  <V extends IType>(value: V): Type<V>;
  <V extends IType, T>(value: V, self: T): Type<V> & T;
} = <V extends IType, T>(value: V, self?: T): Type<V> | (Type & T) => {
  const res = (self ?? {}) as unknown as Type<V>;
  res[$isType] = true;
  res.value = value as any;
  res.or = (other) => $type(TypeFns.or(res.value, other.value));
  res.and = (other) => $type(TypeFns.and(res.value, other.value));
  res.cmp = (other) => TypeFns.cmp(res.value, other.value);
  res.toString = () => TypeFns.string(res.value);
  res.isType = () => TypeFns.isType(res.value);
  return res;
};

export const type = <K extends keyof ITypeMap>(
  key: K,
  value: ITypeMap[K]
): ISingleType<K> => [{ type: key, values: [value] }];

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
  *splitTypes(values: IType): Iterable<ISingleType> {
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
  string: (val: IVal) => getFns(val.type).string(val.values),
  isType: (val: IVal) => getFns(val.type).isType(val.values),
  splitTypes: (val: IVal) =>
    getFns(val.type).splitTypes(val.values) as Iterable<ISingleType>
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
  _get: <T>(obj: IKnown<K>, key: IKey<K>, never: T) => IType | T;
  _keysOr: (a: IKey<K>, b: IKey<K>) => [IKey<K>] | [IKey<K>, IKey<K>];
  _size: (obj: IKnown<K>) => number;
  _unionKeys?: (as: IKnown<K>, bs: IKnown<K>) => Iterable<IKey<K>>;
  _new: (iter?: Iterable<[IKey<K>, IType]>) => IKnown<K>;
  _stringKey: (key: IKey<K>) => string;
  _stringWrap: [string, string];
}

interface ICollectionFns<K extends "array" | "object"> {
  size: (obj: ITypeMap[K]) => number;
  knownSize: (obj: ITypeMap[K]) => number;
  get: (obj: ITypeMap[K], key: IKey<K>) => IType;
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
  ): IType | T => {
    const val = args._get(obj.known, key, never);
    if (val !== never) return val;
    if (obj.unknown[0].type === "never") return never;
    return TypeFns.or(obj.unknown, $null.value);
  };

  const cmp = (as: ITypeMap[K], bs: ITypeMap[K], sortOnly = false): Cmp => {
    let res: Cmp = Cmp.Equal;

    for (const key of unionKeys(as.known, bs.known)) {
      const a = _get(as, key, null);
      if (a === null) return UtilFns.cmpJoin(res, Cmp.Subset);

      const b = _get(bs, key, null);
      if (b === null) return UtilFns.cmpJoin(res, Cmp.Superset);

      const cmp = TypeFns.cmp(a, b, sortOnly);
      if (sortOnly && cmp !== Cmp.Equal) return cmp;

      res = UtilFns.cmpJoin(res, cmp);
      if (UtilFns.isDisjoint(res)) return res;
    }

    return UtilFns.cmpJoin(res, TypeFns.cmp(as.unknown, bs.unknown, sortOnly));
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
  ): Iterable<[IKey<K>, IType]> {
    for (const key of unionKeys(as.known, bs.known)) {
      yield [
        key,
        TypeFns.or(_get(as, key, $never.value), _get(bs, key, $never.value))
      ];
    }
  }

  return {
    or(as, bs) {
      const unknown = TypeFns.or(as.unknown, bs.unknown);
      const known = args._new(unionVals(as, bs));
      return [{ known, unknown }] as [ITypeMap[K]];
    },
    and(as, bs) {
      const res: Array<[IKey<K>, IType]> = [];

      for (const key of unionKeys(as.known, bs.known)) {
        const a = _get(as, key, null);
        if (a === null) return [];

        const b = _get(bs, key, null);
        if (b === null) return [];

        const val = TypeFns.and(a, b);
        if (val[0].type === "never") return [];

        res.push([key, val]);
      }

      const known = args._new(res.values());
      const unknown = TypeFns.and(as.unknown, bs.unknown);
      return [{ known, unknown }] as [ITypeMap[K]];
    },
    cmp,
    string(obj) {
      const strs: string[] = [];
      for (const key of obj.known.keys() as IKeys) {
        const val: IType = _get(obj, key, $never.value);
        strs.push(`${args._stringKey(key)}${TypeFns.string(val)}`);
      }
      if (obj.unknown[0].type !== "never") {
        strs.push(`of ${TypeFns.string(obj.unknown)}`);
      }
      return `${args._stringWrap[0]}${strs.join(", ")}${args._stringWrap[1]}`;
    },
    get(obj, key) {
      return _get(obj, key, $never.value);
    },
    size(obj) {
      return obj.unknown[0].type === "never" ? args._size(obj.known) : Infinity;
    },
    knownSize(obj) {
      return args._size(obj.known);
    },
    isType(obj) {
      if (obj.unknown[0].type !== "never") return true;
      for (const key of obj.known.keys() as IKeys) {
        const val = args._get(obj.known, key, null as never);
        if (TypeFns.isType(val)) return true;
      }
      return false;
    },
    *splitTypes(obj): Iterable<ITypeMap[K]> {
      const combos: Array<Iterable<any>> = [TypeFns.splitTypes(obj.unknown)];

      for (const key of obj.known.keys() as IKeys) {
        combos.push(
          UtilFns.map(TypeFns.splitTypes(_get(obj, key)), (val) => [key, val])
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
    new(known: IType[], unknown?: IType): ISingleType<"array"> {
      return type("array", { known, unknown: unknown ?? $never.value });
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
    new(known: Array<[string, IType]>, unknown?: IType): ISingleType<"object"> {
      return type("object", {
        known: new Map(known),
        unknown: unknown ?? $never.value
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

type IFn<T> = (...args: T[]) => IType;
type IArgs = Type[] | [...Type[], IOptional];
type IOptional = Type[] | [...Type[], IVararg];
type IVararg = [Type];

interface IFnDec<T> {
  (args: IArgs, fn: IFn<IType>): T;
  (args: IArgs, type: Type, valufy: number[], valFn: IFn<any>): T;
}

interface IFnBuilder {
  add: IFnDec<IFnBuilder>;
  build: () => IFn<IType>;
}

export const define = (name: string, vectorize: number[]): IFnBuilder => {
  const fns: Array<{
    types: ISingleType<"array">;
    fn: IFn<ISingleType>;
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
    (def: Type, valufy: number[], fn: IFn<any>): IFn<ISingleType> =>
    (...args: ISingleType[]): IType => {
      for (const pos of valufy.filter((pos) => pos < args.length)) {
        const arg = args[pos];
        if (TypeFns.isType(arg as IType)) return def.value;
        args[pos] = arg[0].values as any;
      }
      return fn(...args);
    };

  const vectorizeFn =
    (fn: IFn<ISingleType>): IFn<ISingleType> =>
    (...args: ISingleType[]): IType => {
      const vecMap = new Map<number, ISingleType<"array">>();

      for (const pos of vectorize) {
        const arg = args[pos];
        if (arg[0].type !== "array") continue;
        vecMap.set(pos, arg as ISingleType<"array">);
      }

      const vecs = [...vecMap.values()].map((t) => t[0].values[0]);
      if (vecs.length === 0) return fn(...args);

      const maxOrInfinity = Math.min(...vecs.map(ArrayFns.size));
      const min = Math.min(...vecs.map(ArrayFns.knownSize));
      const max =
        maxOrInfinity !== Infinity
          ? maxOrInfinity
          : Math.max(...vecs.map(ArrayFns.knownSize));

      let $res = $array([]).value;
      const results: IType[] = min === 0 ? [$res] : [];

      for (let subPos = 0; subPos < max; subPos++) {
        const subArgs: ISingleType[] = [...args];

        for (const [vecPos, $vecArg] of vecMap.entries()) {
          subArgs[vecPos] = ArrayFns.get(
            $vecArg[0].values[0],
            subPos
          ) as ISingleType;
        }

        $res = structuredClone($res);
        $res[0].values[0].known.push(fn(...subArgs));

        if (subPos + 1 >= min) {
          results.push($res);
        }
      }

      if (maxOrInfinity === Infinity) {
        const lastPos = results.length - 1;
        const last = results[lastPos] as ISingleType<"array">;
        const subArgs = [...args];

        for (const [vecPos, vecArg] of vecMap.entries()) {
          subArgs[vecPos] = ArrayFns.get(
            vecArg[0].values[0],
            max
          ) as ISingleType;
        }

        results[lastPos] = [
          {
            type: "array",
            values: [
              {
                known: last[0].values[0].known,
                unknown: fn(...subArgs)
              }
            ]
          }
        ];
      }

      return results.reduce(TypeFns.or, $never.value);
    };

  const add: IFnBuilder["add"] = (
    args: IArgs,
    typeOrFn: Type | IFn<IType>,
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
    const types = $array(argList, vararg ?? $never).value;

    // valufy function
    let fn =
      typeof typeOrFn === "function"
        ? (typeOrFn as IFn<ISingleType>)
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
    (...args: IType[]): IType => {
      // propagate errors
      const errors = args.filter((arg) => arg[0].type === "never");

      if (errors.length > 0) {
        return errors.reduce(TypeFns.or, $never.value);
      }

      // finds match
      const argList = ArrayFns.new(args);
      let matchFn: IFn<ISingleType> | null = null;

      for (const { types, fn } of fns) {
        const cmp = TypeFns.cmp(argList, types);
        if (cmp === Cmp.Equal || cmp === Cmp.Subset) {
          matchFn = fn;
          break;
        }
      }

      // throws error if none found
      if (matchFn === null) {
        return type(
          "never",
          `No implementation of '${name}' found for arguments: ${args
            .map((arg) => TypeFns.string(arg))
            .join(", ")}`
        );
      }

      // union all results
      const combos = args.map((arg) => TypeFns.splitTypes(arg));
      let res = $never.value as IType;

      for (const combo of UtilFns.cartesian(combos)) {
        res = TypeFns.or(res, matchFn(...combo));
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

export const $any = $type(type("any", null));

export const $never = $type(
  type("never", null),
  callable({
    $: (msg: string) => $type(type("never", msg)),
    andError: (a: Type, b: Type) => $never(NeverFns.error(a.value, b.value))
  })
);

export const $array = $type(
  ArrayFns.new([], $any.value),
  <K extends Type, U extends Type = typeof $never>(known: K[], unknown?: U) =>
    $type(
      ArrayFns.new(
        known.map((t) => t.value),
        unknown?.value ?? $never.value
      )
    )
);

export const $boolean = $type(type("boolean", null), (val: boolean) =>
  $type(type("boolean", val))
);

export const $true = $boolean(true);
export const $false = $boolean(false);

export const $date = $type(type("date", null), (date: L.DateTime) =>
  $type(type("date", date))
);

export const $duration = $type(type("duration", null), (duration: L.Duration) =>
  $type(type("duration", duration))
);

export const $function = $type<
  [{ type: "function"; values: [(...args: IType[]) => IType] }],
  IFnDec<Type>
>(
  type("function", () => $any.value),
  (...args: [any, any]) => {
    const res = define("<lambda>", [])
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .add(...args)
      .build();

    return $type(type("function", res));
  }
);

export const $link = (() => {
  throw new Error("TODO");
}) as unknown as SingleType<"link">;

export const $null = $type(type("null", null));

export const $number = $type(type("number", null), (val: number) =>
  $type(type("number", val))
);

export const $object = $type(
  ObjectFns.new([], $any.value),
  (known: Record<string, Type>, unknown?: Type) => {
    const knownVals: Array<[string, IType]> = [];

    for (const key of Object.keys(known).sort(StringFns._cmp)) {
      knownVals.push([key, known[key].value]);
    }

    return $type(ObjectFns.new(knownVals, unknown?.value));
  }
);

export const $string = $type(type("string", null), (val: string) =>
  $type(type("string", val))
);

export const $widget = (() => {
  throw new Error("TODO");
}) as unknown as SingleType<"widget">;
