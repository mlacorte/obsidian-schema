import {
  $any,
  $array,
  $never,
  $null,
  $object,
  builtins,
  type SingleType,
  singleType,
  type Type
} from ".";
import { TypeSet } from "./typeset";
import { Cmp } from "./util";

export type path = string;

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
  notes: Map<path, INote>;
}

export interface IContext {
  global: IGlobalContext;
  note: INote;
  scope: Map<string, TypeRef>;
}

export class Context implements IGlobalContext {
  public notes = new Map<path, INote>();

  empty(): IContext {
    const $this: ObjectRef = { type: "ref/obj", vals: new Map(), of: $any };

    const note: INote = {
      this: $this,
      deps: new Set(),
      reverseDeps: new Set()
    };

    const scope = new Map<string, TypeRef>([
      ...Object.entries(builtins),
      ["this", $this]
    ]);

    return { global: this, note, scope };
  }

  eval(fn: (ctx: IObjectCtx) => void): Type {
    return fromTypeRef(evalObj(this.empty(), fn)).type();
  }

  get(path: path): Type | null {
    const note = this.notes.get(path);
    if (note === undefined) return null;
    return fromTypeRef(note.this).type();
  }

  add(path: path, fn: (ctx: IObjectCtx) => void): void {
    const ctx = this.empty();
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

      return lazy(ctx, () => {
        const curr = ctx.scope.get(name)!;
        if (curr === undefined) return TypeSet.val($null);

        const objSet = fromTypeRef(curr);
        const propsSet = properties.map((v) => fromTypeRef(v));

        return TypeSet.call([objSet, ...propsSet], (obj, ...props) => {
          let res: Type = obj;

          for (const prop of props) {
            res = res.get(prop);
            if (res.cmp($null) === Cmp.Equal) return $null;
          }

          return res;
        });
      });
    },
    call: (fnRef, argRefs) => {
      const ctx = ref.ctx;
      const fnSet = fromTypeRef(fnRef);
      const argSets = argRefs.map((arg) => fromTypeRef(arg));

      return strict(TypeSet.eval(ctx, fnSet, argSets));
    },
    fn: (args, expr) => {
      const snapshot = ref.ctx;
      const cleaned: Array<[name: string, type: Type]> = args.map((a) =>
        typeof a === "string" ? [a, $any] : a
      );

      return singleType("function", (_, ...args): TypeSet => {
        const ctx = cloneCtx(snapshot);

        for (const [pos, arg] of args.slice(0, cleaned.length).entries()) {
          const [name, type] = cleaned[pos];

          ctx.scope.set(
            name,
            strict(
              TypeSet.call([arg], (arg) => {
                switch (arg.cmp(type)) {
                  case Cmp.Equal:
                  case Cmp.Subset:
                    return arg;
                  default:
                    return $never.andError(arg, type);
                }
              })
            )
          );
        }

        return fromTypeRef(evalExpr(ctx, expr));
      });
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

export const lazy = (ctx: IContext, fn: () => TypeSet): Thunk => {
  const obj = { type: "ref/thunk" } as Thunk;
  const thunkId = thunkCtr++;

  const get = (): TypeSet => {
    let value: TypeSet;

    // cycle detection
    if (!runningThunks.has(thunkId)) {
      runningThunks.add(thunkId);
      value = fn();
      runningThunks.delete(thunkId);
    } else {
      value = TypeSet.val($never("Cycle detected"));
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

export const strict = (val: TypeSet): Thunk => ({ type: "ref/thunk", val });

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

export const fromTypeRef = (ref: TypeRef): TypeSet => {
  switch (ref.type) {
    case "ref/obj":
      return fromObjectRef(ref);
    case "ref/arr":
      return fromArrayRef(ref);
    case "ref/or":
      return fromOrRef(ref);
    case "ref/and":
      return fromAndRef(ref);
    case "ref/thunk":
      return ref.val;
    default:
      return TypeSet.val(ref);
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

export const fromObjectRef = (obj: ObjectRef): TypeSet => {
  const keys = [...obj.vals.keys()];
  const vals = [...obj.vals.values()].map((v) => fromTypeRef(v));
  const of = fromTypeRef(obj.of);

  return TypeSet.call([of, ...vals], (unknown, ...knownVals) => {
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

export const fromArrayRef = (arr: ArrayRef): TypeSet => {
  const vals = arr.vals.map((v) => fromTypeRef(v));
  const of = fromTypeRef(arr.of);

  return TypeSet.call([of, ...vals], (unknown, ...known) =>
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

export const fromOrRef = (or: OrRef): TypeSet => {
  const ors = or.vals.map((v) => fromTypeRef(v));

  return TypeSet.call(ors, (...types) =>
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

export const fromAndRef = (or: AndRef): TypeSet => {
  const ands = or.vals.map((v) => fromTypeRef(v));

  return TypeSet.call(ands, (...types) =>
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
  fn: (
    args: Array<string | [string, Type]>,
    expr: (ctx: IExprCtx) => TypeRef
  ) => SingleType<"function">;
  obj: (obj: (ctx: IObjectCtx) => void) => TypeRef;
  arr: (arr: (ctx: IArrayCtx) => void) => TypeRef;
  or: <T extends TypeRef>(a: T, ...bs: TypeRef[]) => T | OrRef;
  and: <T extends TypeRef>(a: T, ...bs: TypeRef[]) => T | AndRef;
}
