import * as L from "luxon";

import { intersectIter, mergeObj, unionIter } from "./util";

// any
type AnyMap = TypeMap & {
  union: Union;
  never: never;
};
type AnyKey = keyof AnyMap;

// type
type TypeMap = PrimMap & {
  object: Map<string, IAny>;
  array: Array<IAny>;
  tuple: Array<IAny>;
  function: { args: IAny[]; return: IAny };
};
type TypeKey = keyof TypeMap;
type TypeVal<K extends TypeKey = TypeKey> = TypeMap[K];

export interface IAny {
  kind: AnyKey;
  type: boolean;
  types: Set<TypeKey>;
  values: Set<TypeVal>;
  or(other: IAny): IAny;
  and(other: IAny): IAny;
}

export interface INever extends IAny {
  kind: "never";
  type: true;
  types: Set<never>;
  values: Set<never>;
}

export interface IType<K extends TypeKey = TypeKey> extends IAny {
  kind: K;
  type: boolean;
  types: Set<K>;
  values: Set<TypeVal<K>>;
}

export interface IUnion extends IAny {
  kind: "union";
  type: true;
  subtypes: { [K in TypeKey]?: IType<K> };
}

abstract class TypeBase<K extends TypeKey> implements IType<K> {
  abstract kind: K;
  abstract type: boolean;
  abstract types: Set<K>;
  abstract values: Set<TypeVal<K>>;

  or(other: IAny): IAny {
    switch (other.kind) {
      case "never":
        return this;
      case "union":
        return other.or(this);
      case this.kind:
        return this.type
          ? this
          : other.type
          ? other
          : this._or(other as IType<K>);
      default:
        return Union.from(this, other);
    }
  }

  and(other: IAny): IAny {
    switch (other.kind) {
      case "never":
        return Never;
      case "union":
        return other.and(this);
      case this.kind:
        return this.type
          ? other
          : other.type
          ? this
          : this._and(other as IType<K>);
      default:
        return Never;
    }
  }

  protected abstract _or(other: IType<K>): IAny;
  protected abstract _and(other: IType<K>): IAny;
}

// prim
type PrimMap = {
  null: null;
  number: number;
  string: string;
  boolean: boolean;
  date: L.DateTime;
  duration: L.Duration;
  link: string;
};
type PrimKey = keyof PrimMap;

class PrimType<K extends PrimKey> extends TypeBase<K> {
  types: Set<K>;

  get type(): boolean {
    return this.values.size !== 1;
  }

  constructor(public kind: K, public values: Set<TypeVal<K>> = new Set()) {
    super();
    this.types = new Set([this.kind]);
  }

  from(val: TypeVal<K>, ...vals: TypeVal<K>[]): PrimType<K> {
    return new PrimType(this.kind, new Set([val, ...vals]));
  }

  protected _or(other: IType<K>): IAny {
    return new PrimType(this.kind, unionIter(this.values, other.values));
  }

  protected _and(other: IType<K>): IAny {
    const vals = intersectIter(this.values, other.values);

    return vals.size === 0 ? Never : new PrimType(this.kind, vals);
  }
}

export const Null = new PrimType("null");
export const Number = new PrimType("number");
export const String = new PrimType("string");
export const Boolean = new PrimType("boolean");
export const Date = new PrimType("date");
export const Duration = new PrimType("duration");
export const Link = new PrimType("link");

// union
class Union implements IUnion {
  kind = "union" as const;
  type = true as const;

  get values(): Set<TypeVal> {
    return new Set(
      Object.values(this.subtypes).flatMap((type) => [...type.values])
    );
  }

  get types(): Set<TypeKey> {
    return new Set(Object.keys(this.subtypes) as TypeKey[]);
  }

  private constructor(public subtypes: { [K in TypeKey]?: IType<K> }) {}

  static from(type: IAny, ...types: IAny[]): IUnion | INever {
    return types.reduce(
      (l, r) => l.or(r),
      ["union", "never"].includes(type.kind)
        ? type
        : new Union({ [type.kind]: type })
    ) as IUnion | INever;
  }

  or(other: IAny): IAny {
    if (other.kind === "never") {
      return this;
    }

    const that = Union.from(other) as Union;

    return new Union(
      mergeObj(this.subtypes, that.subtypes, (key) => {
        const l = this.subtypes[key];
        const r = that.subtypes[key];

        if (l && r) {
          return l.or(r);
        } else if (l) {
          return l;
        } else if (r) {
          return r;
        }
      })
    );
  }

  and<T extends IAny>(other: T): IAny {
    if (other.kind === "never") {
      return other;
    }

    const that = Union.from(other) as Union;

    const res = mergeObj(this.subtypes, that.subtypes, (key) => {
      const l = this.subtypes[key];
      const r = that.subtypes[key];

      if (l && r) {
        return l.and(r);
      }
    });

    const vals = Object.values(res);

    switch (vals.length) {
      case 0:
        return Never;
      case 1:
        return vals[0];
      default:
        return new Union(res);
    }
  }
}

// never
export const Never = {
  kind: "never" as const,
  type: true as const,
  types: new Set<never>(),
  values: new Set<never>(),

  or(other: IAny): IAny {
    return other;
  },

  and(_other: IAny): IAny {
    return Never;
  }
};

// object
class ObjectType extends TypeBase<"object"> {
  kind = "object" as const;
  type: boolean;
  types = new Set<"object">(["object"]);
  values: Set<Map<string, IAny>>;

  constructor(values?: Set<Map<string, IAny>>) {
    super();
    this.type = !values;
    this.values = values || new Set();
  }

  protected _or(other: IType<"object">): IAny {
    throw "todo";
  }

  protected _and(other: IType<"object">): IAny {
    throw "todo";
  }
}

const _Object = new ObjectType();
export { _Object as Object };

// array
class ArrayType {} // array<type>

// tuple
class TupleType {} // array<type>

// function
class FunctionType {} // { args: tuple<any>, return: any }
