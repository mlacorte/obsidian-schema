import {
  $array,
  $number,
  $object,
  $string,
  builtins,
  type ops,
  type Type
} from ".";

export type id = bigint & { id: never };
export type path = string & { path: never };
export type identifier = string & { identifier: never };

export interface INote {
  identifiers: Map<identifier, id>;
  ids: Set<id>;
  deps: Set<path>;
  reverseDeps: Set<path>;
}

export interface IPossibleType {
  type: Type;
  conds: Map<id, Type>;
  deps: Set<id>;
  reverseDeps: Set<id>;
}

export class Context {
  public id = BigInt(1) as id;
  nextId = (): id => this.id++ as id;

  public notes = new Map<path, INote>();
  public types = new Map<id, IPossibleType[]>();
  public current: path = "<default>" as path;

  add(path: path, fn: (ctx: IObjectCtx) => void): void {
    this.current = path;
    const refs = lazyObj(this, $object({ ...builtins, this: $object({}) }));
    void evalObj(this, refs, fn);
  }

  remove(path: path): Set<path> {
    const tbd = new Set([path]);
    const deleted = new Set<path>();

    while (tbd.size > 0) {
      const path: path = tbd.values().next().value;
      const note = this.notes.get(path)!;

      // mark as deleted
      tbd.delete(path);
      deleted.add(path);

      // delete the types
      for (const id of note.ids) {
        this.types.delete(id);
      }

      // queue reverse deps for deletion
      for (const dep of note.reverseDeps) {
        if (!deleted.has(dep)) tbd.add(dep);
      }
    }

    return deleted;
  }

  narrow(_id: id, _type: Type): Context {
    throw new Error("TODO");
  }
}

const evalObj = (
  ctx: Context,
  refs: LazyObj,
  fn: (ctx: IObjectCtx) => void
): LazyObj => {
  const obj: IObjectCtx = {
    local(_key, _expr) {
      // TODO
    },
    set(_key, _expr) {
      // TODO
    },
    of(_val) {
      // TODO
    },
    include(_val) {
      // TODO
    }
  };

  fn(obj);

  throw new Error("TODO");
};

export interface Thunk<V> {
  type: "thunk";
  val: V;
}

export const lazy = <V>(fn: () => V): Thunk<V> => {
  const obj = {} as Thunk<V>;

  const get = (): V =>
    Object.defineProperty(obj, "val", {
      configurable: false,
      enumerable: true,
      value: fn()
    }).val;

  return Object.defineProperty(obj, "val", {
    configurable: true,
    enumerable: true,
    get
  });
};

export const strict = <V>(val: V): Thunk<V> => ({ type: "thunk", val });

export type LazyType = Thunk<Type> | LazyObj | LazyArr;

const fromLazy = (arg: LazyType): Type => {
  switch (arg.type) {
    case "obj":
      return fromLazyObj(arg);
    case "arr":
      return fromLazyArr(arg);
    default:
      return arg.val;
  }
};

export const lazyType = (ctx: Context, arg: Type): LazyType => {
  switch (arg.type) {
    case "object":
      return lazyObj(ctx, arg as Type<"object">);
    case "array":
      return lazyArr(ctx, arg as Type<"array">);
    default:
      return strict(arg);
  }
};

export interface LazyObj {
  type: "obj";
  vals: Map<string, LazyType>;
  of: LazyType;
}

export const lazyObj = (ctx: Context, type: Type<"object">): LazyObj => {
  const vals = new Map<string, LazyType>();
  const of = lazyType(ctx, type.value.unknown);

  for (const [key, val] of type.value.known) {
    vals.set(key, lazyType(ctx, val));
  }

  return { type: "obj", vals, of };
};

export const fromLazyObj = (lazy: LazyObj): Type<"object"> =>
  $object(
    [...lazy.vals.entries()].reduce<Record<string, Type>>(
      (res, [key, type]) => {
        res[key] = fromLazy(type);
        return res;
      },
      {}
    ),
    fromLazy(lazy.of)
  );

export interface LazyArr {
  type: "arr";
  vals: LazyType[];
  of: LazyType;
}

export const fromLazyArr = (lazy: LazyArr): Type<"array"> =>
  $array(
    lazy.vals.map((a) => fromLazy(a)),
    fromLazy(lazy.of)
  );

export const lazyArr = (ctx: Context, type: Type<"array">): LazyArr => {
  const vals = type.value.known.map((t) => strict(t));
  const of = lazyType(ctx, type.value.unknown);
  return { type: "arr", vals, of };
};

export interface IObjectCtx {
  local: (key: string, expr: (ctx: IExprCtx) => Type | LazyType) => void;
  set: (key: string, expr: (ctx: IExprCtx) => Type | LazyType) => void;
  of: (val: Type | LazyType) => void;
  include: (val: Type | LazyType) => void;
}

export interface IArrayCtx extends IExprCtx {
  set: (val: Type | LazyType) => void;
  of: (val: Type | LazyType) => void;
  include: (val: Type | LazyType) => void;
}

export interface IExprCtx {
  local: (key: string, expr: (ctx: IExprCtx) => Type | LazyType) => void;
  get: (keys: string[]) => Thunk<Type>;
  lit: (key: keyof typeof ops) => Thunk<Type<"function">>;
  call: (fn: Type | LazyType, args: Array<Type | LazyType>) => Thunk<Type>;
  fn: (
    args: string[],
    expr: (ctx: IExprCtx) => void
  ) => Thunk<Type<"function">>;
  obj: (obj: (ctx: IObjectCtx) => void) => LazyObj;
  arr: (arr: (ctx: IArrayCtx) => void) => LazyArr;
}

const _test = (): Type => {
  const fakeEval = (_obj: (ctx: IObjectCtx) => void): Type => {
    throw new Error("TODO");
  };

  return fakeEval((c) => {
    c.local("cmp", (c) =>
      c.fn(["a", "b"], (c) => c.call(c.get(["error"]), [$string("NEVER")]))
    );

    c.local("cmp", (c) =>
      c.fn(["a", "b"], (c) => c.call(c.lit("lt"), [c.get(["a"]), c.get(["b"])]))
    );

    c.set("foo", (c) =>
      c.obj((c) => {
        c.set("a", () => $number(10));
        c.set("bar", (c) => c.get(["this", "bar", "foo"]));
      })
    );

    c.set("bar", (c) =>
      c.obj((c) => {
        c.set("foo", (c) => c.get(["this", "foo", "a"]));
      })
    );

    c.set("other", (c) => {
      c.local("a", () => $number(10));
      c.local("b", () => $number(10));

      return c.arr((c) => {
        c.set(c.get(["a"]));
        c.set(c.get(["b"]));
        c.set(c.call(c.lit("plus"), [c.get(["a"]), c.get(["b"])]));
      });
    });

    c.set("test", (c) => {
      c.local("a", () => $number(10));

      return c.get(["a"]);
    });

    c.set("a", () => $number(20));

    c.set("b", () => $number(10).or($number(30)));

    c.set("choice", (c) =>
      c.call(c.get(["choice"]), [
        c.call(c.get(["cmp"]), [c.get(["this", "a"]), c.get(["this", "b"])]),
        c.call(c.lit("plus"), [c.get(["this", "a"]), $number(3)]),
        c.call(c.lit("plus"), [c.get(["this", "b"]), $number(5)])
      ])
    );

    c.set("c", () => $number(23));
  });
};
