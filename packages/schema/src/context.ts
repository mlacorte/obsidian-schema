import {
  $array,
  $never,
  $number,
  $object,
  $string,
  builtins,
  type ops,
  type SingleType,
  type Type
} from ".";
import { $val, type id, type TypeSet } from "./typeset";

export type path = string & { path: never };
export type identifier = string & { identifier: never };

export type TypeRef = Type | BranchRef | ObjectRef | ArrayRef | Thunk<TypeRef>;

export interface INote {
  identifiers: ObjectRef;
  ids: Set<id>;
  deps: Set<path>;
  reverseDeps: Set<path>;
}

export interface IGlobalContext {
  ctr: id;
  notes: Map<path, INote>;
}

export interface IContext {
  global: IGlobalContext;
  path: path;
  note: INote;
  branches: Map<id, TypeSet>;
  scope: ObjectRef;
}

export class Context implements IGlobalContext {
  public ctr = BigInt(1);
  public notes = new Map<path, INote>();
  public branches = new Map<id, TypeSet>();

  add(path: path, fn: (ctx: IObjectCtx) => void): void {
    const ctx: IContext = {
      global: this,
      path,
      note: null as any, // added below
      branches: new Map(
        [...this.branches.values()].map((t) => [t.id, t.clone()])
      ),
      scope: null as any // added below
    };

    ctx.scope = objectRef(ctx, $object({ ...builtins, this: $object({}) }));

    ctx.note = {
      identifiers: ctx.scope.vals.get("this") as ObjectRef,
      ids: new Set(),
      deps: new Set(),
      reverseDeps: new Set()
    };

    this.notes.set(path, ctx.note);

    evalObj(ctx, fn);
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
        this.branches.delete(id);
      }

      // queue reverse deps for deletion
      for (const dep of note.reverseDeps) {
        if (!deleted.has(dep)) tbd.add(dep);
      }
    }

    return deleted;
  }
}

const evalObj = (ctx: IContext, fn: (ctx: IObjectCtx) => void): ObjectRef => {
  const obj = objectRef(ctx, $object({}));

  fn({
    local(key, expr) {
      ctx.scope.vals.set(key, evalExpr(ctx, expr));
    },
    set(_key, _expr) {
      throw new Error("TODO");
    },
    of(_val) {
      throw new Error("TODO");
    },
    include(_val) {
      throw new Error("TODO");
    }
  });

  return obj;
};

const evalArr = (ctx: IContext, fn: (ctx: IArrayCtx) => void): ArrayRef => {
  const arr = arrayRef(ctx, $array([]));

  fn({
    set: (_val) => {
      throw new Error("TODO");
    },
    of: (_val) => {
      throw new Error("TODO");
    },
    include: (_val: TypeRef) => {
      throw new Error("TODO");
    },
    local: (_key, _expr) => {
      throw new Error("TODO");
    },
    get: (_keys) => {
      throw new Error("TODO");
    },
    op: (_key) => {
      throw new Error("TODO");
    },
    call: (_fn, _args) => {
      throw new Error("TODO");
    },
    fn: (_args, _expr) => {
      throw new Error("TODO");
    },
    obj: (obj) => {
      return evalObj(ctx, obj);
    },
    arr: (arr) => {
      return evalArr(ctx, arr);
    }
  });

  return arr;
};

const evalExpr = (ctx: IContext, fn: (ctx: IExprCtx) => TypeRef): TypeRef =>
  fn({
    local: (_key, _expr) => {
      throw new Error("TODO");
    },
    get: (_keys) => {
      throw new Error("TODO");
    },
    op: (_key) => {
      throw new Error("TODO");
    },
    call: (_fn, _args) => {
      throw new Error("TODO");
    },
    fn: (_args, _expr) => {
      throw new Error("TODO");
    },
    obj: (obj) => {
      return evalObj(ctx, obj);
    },
    arr: (arr) => {
      return evalArr(ctx, arr);
    }
  });

export interface Thunk<V> {
  type: "thunk";
  val: V | SingleType<"never">;
}

let thunkCtr = BigInt(1);
const runningThunks = new Set<bigint>();

export const thunk = <V>(fn: () => V): Thunk<V> => {
  const obj = {} as Thunk<V>;
  const id = thunkCtr++;

  const get = (): V | SingleType<"never"> => {
    let value: V | SingleType<"never">;

    // cycle detection
    if (!runningThunks.has(id)) {
      runningThunks.add(id);
      value = fn();
      runningThunks.delete(id);
    } else {
      value = $never("Cycle detected");
    }

    // only run once
    return Object.defineProperty(obj, "val", {
      configurable: false,
      enumerable: true,
      value
    }).val;
  };

  return Object.defineProperty(obj, "val", {
    configurable: true,
    enumerable: true,
    get
  });
};

export const typeRef = (ctx: IContext, types: Type): TypeRef => {
  if (types.values.length > 0) return branchRef(ctx, types);

  switch (types.type) {
    case "object":
      return objectRef(ctx, types as Type<"object">);
    case "array":
      return arrayRef(ctx, types as Type<"array">);
    default:
      return types.isSingle() ? types : branchRef(ctx, types);
  }
};

export const fromTypeRef = (ctx: IContext, ref: TypeRef): Type => {
  switch (ref.type) {
    case "obj":
      return fromObjectRef(ctx, ref);
    case "arr":
      return fromArrayRef(ctx, ref);
    case "branch":
      return fromBranchRef(ctx, ref);
    case "thunk":
      return fromTypeRef(ctx, ref.val);
    default:
      return ref;
  }
};

export interface BranchRef {
  type: "branch";
  id: id;
}

export const branchRef = (ctx: IContext, types: Type): BranchRef => {
  const set = $val(ctx.global.ctr++, types);
  ctx.note.ids.add(set.id);
  ctx.branches.set(set.id, set);

  return { type: "branch", id: set.id };
};

export const fromBranchRef = (ctx: IContext, branch: BranchRef): Type =>
  ctx.branches
    .get(branch.id)!
    .potentials.reduce<Type>((res, branch) => res.or(branch.type), $never);

export interface ObjectRef {
  type: "obj";
  vals: Map<string, TypeRef>;
  of: TypeRef;
}

export const objectRef = (ctx: IContext, type: Type<"object">): ObjectRef => {
  const vals = new Map<string, TypeRef>();
  const of = thunk(() => typeRef(ctx, type.value.unknown));

  for (const [key, val] of type.value.known) {
    vals.set(
      key,
      thunk(() => typeRef(ctx, val))
    );
  }

  return { type: "obj", vals, of };
};

export const fromObjectRef = (ctx: IContext, obj: ObjectRef): Type<"object"> =>
  $object(
    [...obj.vals.entries()].reduce<Record<string, Type>>((res, [key, type]) => {
      res[key] = fromTypeRef(ctx, type);
      return res;
    }, {}),
    fromTypeRef(ctx, obj.of)
  );

export interface ArrayRef {
  type: "arr";
  vals: TypeRef[];
  of: TypeRef;
}

export const arrayRef = (ctx: IContext, type: Type<"array">): ArrayRef => ({
  type: "arr",
  vals: type.value.known.map((t) => thunk(() => typeRef(ctx, t))),
  of: thunk(() => typeRef(ctx, type.value.unknown))
});

export const fromArrayRef = (ctx: IContext, arr: ArrayRef): Type<"array"> =>
  $array(
    arr.vals.map((a) => fromTypeRef(ctx, a)),
    fromTypeRef(ctx, arr.of)
  );

export interface IObjectCtx {
  local: (key: string, expr: (ctx: IExprCtx) => TypeRef) => void;
  set: (key: string, expr: (ctx: IExprCtx) => TypeRef) => void;
  of: (val: TypeRef) => void;
  include: (val: TypeRef) => void;
}

export interface IArrayCtx extends IExprCtx {
  set: (val: TypeRef) => void;
  of: (val: TypeRef) => void;
  include: (val: TypeRef) => void;
}

export interface IExprCtx {
  local: (key: string, expr: (ctx: IExprCtx) => TypeRef) => void;
  get: (keys: string[]) => TypeRef;
  op: (key: keyof typeof ops) => SingleType<"function">;
  call: (fn: TypeRef, args: TypeRef[]) => TypeRef;
  fn: (
    args: string[],
    expr: (ctx: IExprCtx) => void
  ) => Thunk<SingleType<"function">>;
  obj: (obj: (ctx: IObjectCtx) => void) => ObjectRef;
  arr: (arr: (ctx: IArrayCtx) => void) => ArrayRef;
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
      c.fn(["a", "b"], (c) => c.call(c.op("lt"), [c.get(["a"]), c.get(["b"])]))
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
        c.set(c.call(c.op("plus"), [c.get(["a"]), c.get(["b"])]));
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
        c.call(c.op("plus"), [c.get(["this", "a"]), $number(3)]),
        c.call(c.op("plus"), [c.get(["this", "b"]), $number(5)])
      ])
    );

    c.set("c", () => $number(23));
  });
};
