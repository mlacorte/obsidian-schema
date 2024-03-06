import { $array, $never, $number, $object, $string, type Type } from ".";

export type id = bigint & { id: never };
export type path = string & { path: never };
export type identifier = string & { identifier: never };

export interface INote {
  identifiers: Map<identifier, id>;
  ids: Set<id>;
}

export interface IPossibleTypes {
  deps: Set<id>;
  reverseDeps: Set<id>;
  possibles: IPossible[];
}

export interface IPossible {
  type: Type;
  conds: Map<id, Type>;
}

interface Thunk<V> {
  type: "thunk";
  val: V;
}

const lazy = <V>(fn: () => V): Thunk<V> => {
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

const strict = <V>(val: V): Thunk<V> => ({ type: "thunk", val });

interface LazyObj {
  type: "obj";
  vals: Map<string, Thunk<Type>>;
  of: Thunk<Type>;
}

const buildObj = (lazy: LazyObj): Type<"object"> =>
  $object(
    [...lazy.vals.entries()].reduce<Record<string, Type>>(
      (res, [key, thunk]) => {
        res[key] = thunk.val;
        return res;
      },
      {}
    ),
    lazy.of.val
  );

interface LazyArr {
  type: "arr";
  vals: Array<Thunk<Type>>;
  of: Thunk<Type>;
}

const buildArr = (lazy: LazyArr): Type<"array"> =>
  $array(
    lazy.vals.map((a) => a.val),
    lazy.of.val
  );

type LazyType = Type | Thunk<Type> | LazyObj | LazyArr;

interface IBlockCtx {
  local: (key: string, expr: (ctx: IExprCtx) => LazyType) => void;
  set: (key: string, expr: (ctx: IExprCtx) => LazyType) => void;
  of: (val: LazyType) => void;
  include: (val: LazyType) => void;
}

interface IArrayCtx extends IExprCtx {
  set: (val: LazyType) => void;
  of: (val: LazyType) => void;
  include: (val: LazyType) => void;
}

interface IExprCtx {
  local: (key: string, expr: (ctx: IExprCtx) => LazyType) => void;
  get: (keys: string[]) => Thunk<Type>;
  lit: (key: string) => Thunk<Type<"function">>;
  call: (fn: LazyType, args: LazyType[]) => Thunk<Type>;
  fn: (
    args: string[],
    expr: (ctx: IExprCtx) => void
  ) => Thunk<Type<"function">>;
  obj: (obj: (ctx: IBlockCtx) => void) => LazyObj;
  arr: (arr: (ctx: IArrayCtx) => void) => LazyArr;
}

export class Context {
  private static id = BigInt(1) as id;
  private static nextId(): id {
    return Context.id++ as id;
  }

  private constructor(
    private readonly notes = new Map<path, INote>(),
    private readonly possibleTypes = new Map<id, IPossibleTypes>()
  ) {}

  static init(): Context {
    return new Context(); // TODO: add default context
  }

  id(path: path, identifier: identifier): id | null {
    const note = this.notes.get(path);
    if (note === undefined) return null;

    const id = note.identifiers.get(identifier);
    if (id === undefined) return null;

    return id;
  }

  private create(path: path, identifier: identifier): id {
    const id = Context.nextId();
    let note = this.notes.get(path);

    if (note === undefined) {
      note = { identifiers: new Map([[identifier, id]]), ids: new Set([id]) };
      this.notes.set(path, note);
    }

    return id;
  }

  set(path: path, identifier: identifier, type: Type): this {
    const id = this.create(path, identifier);

    this.possibleTypes.set(id, {
      deps: new Set(),
      reverseDeps: new Set(),
      possibles: [...type.splitTypes()].map((type) => ({
        type,
        conds: new Map([[id, type]])
      }))
    });

    return this;
  }

  with(
    path: path,
    identifier: identifier,
    type: Type,
    fn: (ctx: Context) => void
  ): this {
    const origId = this.id(path, identifier);

    this.set(path, identifier, type);
    fn(this);
    const identifiers = this.notes.get(path)!.identifiers;

    if (origId === null) {
      identifiers.delete(identifier);
    } else {
      identifiers.set(identifier, origId);
    }

    return this;
  }

  call(_path: path, _fn: identifier, _args: identifier[]): Type {
    throw new Error("TODO");
  }

  delete(_path: path): Context {
    throw new Error("TODO");
  }

  type(id: id): Type {
    const possible = this.possibleTypes.get(id);
    if (possible === undefined) return $never(`id ${id} doesn't exist`);

    return possible.possibles.reduce<Type<any>>(
      (a, b) => a.type.or(b.type),
      $never
    );
  }

  narrow(_id: id, _type: Type): Context {
    throw new Error("TODO");
  }
}

const _test = (): Type => {
  const fakeEval = (_obj: (ctx: IBlockCtx) => void): Type => {
    throw new Error("TODO");
  };

  return fakeEval(({ local, set }) => {
    local("cmp", ({ fn }) =>
      fn(["a", "b"], ({ call, get }) =>
        call(get(["error"]), [$string("NEVER")])
      )
    );

    local("cmp", ({ fn }) =>
      fn(["a", "b"], ({ call, lit, get }) =>
        call(lit("lt"), [get(["a"]), get(["b"])])
      )
    );

    set("foo", ({ obj }) =>
      obj(({ set }) => {
        set("a", () => $number(10));
        set("bar", ({ get }) => get(["this", "bar", "foo"]));
      })
    );

    set("bar", ({ obj }) =>
      obj(({ set }) => {
        set("foo", ({ get }) => get(["this", "foo", "a"]));
      })
    );

    set("other", ({ local, arr }) => {
      local("a", () => $number(10));
      local("b", () => $number(10));

      return arr(({ set, get, call, lit }) => {
        set(get(["a"]));
        set(get(["b"]));
        set(call(lit("plus"), [get(["a"]), get(["b"])]));
      });
    });

    set("test", ({ local, get }) => {
      local("a", () => $number(10));

      return get(["a"]);
    });

    set("a", () => $number(20));
    set("b", () => $number(10).or($number(30)));
    set("choice", ({ call, get, lit }) =>
      call(get(["choice"]), [
        call(get(["cmp"]), [get(["this", "a"]), get(["this", "b"])]),
        call(lit("plus"), [get(["this", "a"]), $number(3)]),
        call(lit("plus"), [get(["this", "b"]), $number(5)])
      ])
    );

    set("c", () => $number(23));
  });
};
