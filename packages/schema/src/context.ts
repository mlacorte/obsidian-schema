import {
  $any,
  $array,
  $never,
  $null,
  $number,
  $object,
  $string,
  builtins,
  ops,
  type SingleType,
  type Type
} from ".";
import { $fn, $val, type id, type TypeSet } from "./typeset";
import { Cmp } from "./util";

export type path = string & { path: never };
export type identifier = string & { identifier: never };

export type TypeRef =
  | SingleType
  | ObjectRef
  | ArrayRef
  | OrRef
  | AndRef
  | Thunk;

export interface INote {
  this: ObjectRef;
  deps: Set<path>;
  reverseDeps: Set<path>;
}

export interface IGlobalContext {
  ctr: id;
  notes: Map<path, INote>;
}

export interface IContext {
  global: IGlobalContext;
  note: INote;
  scope: Map<string, TypeRef>;
}

export class Context implements IGlobalContext {
  public ctr = BigInt(1);
  public notes = new Map<path, INote>();

  add(path: path, fn: (ctx: IObjectCtx) => void): void {
    const $this: ObjectRef = { type: "ref/obj", vals: new Map(), of: $any };

    const note: INote = {
      this: $this,
      deps: new Set(),
      reverseDeps: new Set()
    };

    this.notes.set(path, note);

    const scope = new Map<string, TypeRef>([
      ...Object.entries(builtins),
      ["this", $this]
    ]);

    const ctx: IContext = { global: this, note, scope };

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

      // queue reverse deps for deletion
      for (const dep of note.reverseDeps) {
        if (!deleted.has(dep)) tbd.add(dep);
      }
    }

    return deleted;
  }
}

const cloneCtx = ({ global, note, scope }: IContext): IContext => ({
  global,
  note,
  scope: new Map(scope)
});

const evalObj = (
  initialCtx: IContext,
  fn: (ctx: IObjectCtx) => void
): ObjectRef | AndRef => {
  const obj = objectRef(initialCtx, $object({}, $any));
  const ands: TypeRef[] = [];
  const ref = { ctx: initialCtx };

  fn({
    local(key, expr) {
      ref.ctx = cloneCtx(ref.ctx);
      ref.ctx.scope.set(key, evalExpr(ref.ctx, expr));
    },
    set(key, expr) {
      obj.vals.set(key, evalExpr(ref.ctx, expr));
    },
    of(expr) {
      obj.of = andRef(obj.of, evalExpr(ref.ctx, expr));
    },
    include(expr) {
      ands.push(evalExpr(ref.ctx, expr));
    }
  });

  return andRef(obj, ...ands);
};

const evalArr = (ctx: IContext, fn: (ctx: IArrayCtx) => void): TypeRef => {
  const arr = arrayRef(ctx, $array([], $any));

  fn({
    set: (expr) => {
      arr.vals.push(evalExpr(ctx, expr));
    },
    of: (expr) => {
      arr.of = andRef(arr.of, evalExpr(ctx, expr));
    }
  });

  return arr;
};

const evalExpr = <T extends TypeRef>(
  initialCtx: IContext,
  fn: (ctx: IExprCtx) => T
): T => {
  const ref = { ctx: initialCtx };

  return fn({
    local: (key, expr) => {
      ref.ctx = cloneCtx(ref.ctx);
      ref.ctx.scope.set(key, evalExpr(ref.ctx, expr));
    },
    get: (name: string, properties = []) => {
      const ctx = ref.ctx;

      return thunk(ctx, () => {
        const curr = ctx.scope.get(name)!;
        if (curr === undefined) return $val(ctx.global.ctr++, $null);

        const objSet = fromTypeRef(ctx, curr);
        const propsSet = properties.map((v) => fromTypeRef(ctx, v));

        return $fn(
          ctx.global.ctr++,
          [objSet, ...propsSet],
          (obj, ...props) => {
            let res: Type = obj;

            for (const prop of props) {
              res = res.get(prop);
              if (res.cmp($null) === Cmp.Equal) return $null;
            }

            return res;
          }
        );
      })
    },
    call: (_fn, _args) => {
      throw new Error("TODO");
    },
    fn: (_args, _expr) => {
      throw new Error("TODO");
    },
    obj: (obj) => {
      return evalObj(ref.ctx, obj);
    },
    arr: (arr) => {
      return evalArr(ref.ctx, arr);
    },
    or: (a, ...bs) => {
      return orRef(a, ...bs);
    },
    and: (a, ...bs) => {
      return andRef(a, ...bs);
    }
  });
};

export interface Thunk {
  type: "ref/thunk";
  val: TypeSet;
}

let thunkCtr = BigInt(1);
const runningThunks = new Set<bigint>();

export const thunk = (ctx: IContext, fn: () => TypeSet): Thunk => {
  const obj = { type: "ref/thunk" } as Thunk;
  const id = thunkCtr++;

  const get = (): TypeSet => {
    let value: TypeSet;

    // cycle detection
    if (!runningThunks.has(id)) {
      runningThunks.add(id);
      value = fn();
      runningThunks.delete(id);
    } else {
      value = $val(ctx.global.ctr++, $never("Cycle detected"));
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

export const typeRef = (ctx: IContext, type: Type): TypeRef => {
  if (type.types.length > 1) {
    return orRef(...type.splitTypesShallow());
  }

  switch (type.type) {
    case "object":
      return objectRef(ctx, type as SingleType<"object">);
    case "array":
      return arrayRef(ctx, type as SingleType<"array">);
    default:
      return type as SingleType;
  }
};

export const fromTypeRef = (ctx: IContext, ref: TypeRef): TypeSet => {
  switch (ref.type) {
    case "ref/obj":
      return fromObjectRef(ctx, ref);
    case "ref/arr":
      return fromArrayRef(ctx, ref);
    case "ref/or":
      return fromOrRef(ctx, ref);
    case "ref/and":
      return fromAndRef(ctx, ref);
    case "ref/thunk":
      return ref.val;
    default:
      return $val(ctx.global.ctr++, ref);
  }
};

export interface ObjectRef {
  type: "ref/obj";
  vals: Map<string, TypeRef>;
  of: TypeRef;
}

export const objectRef = (
  ctx: IContext,
  type: SingleType<"object">
): ObjectRef => {
  const vals = new Map<string, TypeRef>();
  const of = typeRef(ctx, type.value.unknown);

  for (const [key, val] of type.value.known) {
    vals.set(key, typeRef(ctx, val));
  }

  return { type: "ref/obj", vals, of };
};

export const fromObjectRef = (ctx: IContext, obj: ObjectRef): TypeSet => {
  const keys = [...obj.vals.keys()];
  const vals = [...obj.vals.values()].map((v) => fromTypeRef(ctx, v));
  const of = fromTypeRef(ctx, obj.of);

  return $fn(ctx.global.ctr++, [of, ...vals], (unknown, ...knownVals) => {
    const known: Record<string, SingleType> = {};

    for (let i = 0; i < knownVals.length; i++) {
      known[keys[i]] = knownVals[i];
    }

    return $object(known, unknown);
  });
};

export interface ArrayRef {
  type: "ref/arr";
  vals: TypeRef[];
  of: TypeRef;
}

export const arrayRef = (
  ctx: IContext,
  type: SingleType<"array">
): ArrayRef => ({
  type: "ref/arr",
  vals: type.value.known.map((t) => typeRef(ctx, t)),
  of: typeRef(ctx, type.value.unknown)
});

export const fromArrayRef = (ctx: IContext, arr: ArrayRef): TypeSet => {
  const vals = arr.vals.map((v) => fromTypeRef(ctx, v));
  const of = fromTypeRef(ctx, arr.of);

  return $fn(ctx.global.ctr++, [of, ...vals], (unknown, ...known) =>
    $array(known, unknown)
  );
};

export interface OrRef {
  type: "ref/or";
  vals: TypeRef[];
}

export const orRef = <T extends TypeRef>(a: T, ...bs: TypeRef[]): T | OrRef =>
  bs.length === 0
    ? a
    : {
        type: "ref/or",
        vals: [a, ...bs].flatMap((v) => (v.type === "ref/or" ? v.vals : [v]))
      };

export const fromOrRef = (ctx: IContext, or: OrRef): TypeSet => {
  const ors = or.vals.map((v) => fromTypeRef(ctx, v));

  return $fn(ctx.global.ctr++, ors, (...types) =>
    types.reduce<Type>((a, b) => a.or(b), $never)
  );
};

export interface AndRef {
  type: "ref/and";
  vals: TypeRef[];
}

export const andRef = <T extends TypeRef>(
  a: T,
  ...bs: TypeRef[]
): T | AndRef =>
  bs.length === 0
    ? a
    : {
        type: "ref/and",
        vals: [a, ...bs].flatMap((v) => (v.type === "ref/and" ? v.vals : [v]))
      };

export const fromAndRef = (ctx: IContext, or: AndRef): TypeSet => {
  const ands = or.vals.map((v) => fromTypeRef(ctx, v));

  return $fn(ctx.global.ctr++, ands, (...types) =>
    types.reduce<Type>((a, b) => a.and(b), $any)
  );
};

export interface IObjectCtx {
  local: (key: string, expr: (ctx: IExprCtx) => TypeRef) => void;
  set: (key: string, expr: (ctx: IExprCtx) => TypeRef) => void;
  of: (expr: (ctx: IExprCtx) => TypeRef) => void;
  include: (expr: (ctx: IExprCtx) => TypeRef) => void;
}

export interface IArrayCtx {
  set: (expr: (ctx: IExprCtx) => TypeRef) => void;
  of: (expr: (ctx: IExprCtx) => TypeRef) => void;
}

export interface IExprCtx {
  local: (key: string, expr: (ctx: IExprCtx) => TypeRef) => void;
  get: (ref: string, properties?: TypeRef[]) => TypeRef;
  call: (fn: TypeRef, args: TypeRef[]) => TypeRef;
  fn: (args: string[], expr: (ctx: IExprCtx) => void) => TypeRef;
  obj: (obj: (ctx: IObjectCtx) => void) => TypeRef;
  arr: (arr: (ctx: IArrayCtx) => void) => TypeRef;
  or: <T extends TypeRef>(a: T, ...bs: TypeRef[]) => T | OrRef;
  and: <T extends TypeRef>(a: T, ...bs: TypeRef[]) => T | AndRef;
}

const _test = (): Type => {
  const fakeEval = (_obj: (ctx: IObjectCtx) => void): Type => {
    throw new Error("TODO");
  };

  return fakeEval((c) => {
    c.local("cmp", (c) =>
      c.fn(["a", "b"], (c) => c.call(c.get("error"), [$string("NEVER")]))
    );

    c.local("cmp", (c) =>
      c.fn(["a", "b"], (c) => c.call(ops.lt, [c.get("a"), c.get("b")]))
    );

    c.set("foo", (c) =>
      c.obj((c) => {
        c.set("a", () => $number(10));
        c.set("bar", (c) => c.get("this", [$string("bar"), $string("foo")]));
      })
    );

    c.set("bar", (c) =>
      c.obj((c) => {
        c.set("foo", (c) => c.get("this", [$string("foo"), $string("a")]));
      })
    );

    c.set("other", (c) => {
      c.local("a", () => $number(10));
      c.local("b", () => $number(10));

      return c.arr((c) => {
        c.set((c) => c.get("a"));
        c.set((c) => c.get("b"));
        c.set((c) => c.call(ops.plus, [c.get("a"), c.get("b")]));
      });
    });

    c.set("test", (c) => {
      c.local("a", () => $number(10));

      return c.get("a");
    });

    c.set("a", () => $number(20));

    c.set("b", (c) => c.or($number(10), $number(30)));

    c.set("c", (c) =>
      c.call(c.get("choice"), [
        c.call(c.get("cmp"), [
          c.get("this", [$string("a")]),
          c.get("this", [$string("b")])
        ]),
        c.call(ops.plus, [c.get("this", [$string("a")]), $number(3)]),
        c.call(ops.plus, [c.get("this", [$string("b")]), $number(5)])
      ])
    );

    c.set("c", () => $number(23));
  });
};
