import * as Immutable from "immutable";
import * as L from "luxon";

// any
type AnyMap = TypeMap & {
  union: Union;
  never: never;
};
type AnyKey = keyof AnyMap;

// type
type TypeMap = PrimMap & {
  object: Immutable.Map<string, IAny>;
  array: Immutable.List<IAny>;
  tuple: Immutable.List<IAny>;
  function: { args: Immutable.List<IAny>; return: IAny };
};
type TypeKey = keyof TypeMap;
type TypeVal<K extends TypeKey = TypeKey> = TypeMap[K];

export interface IAny extends Immutable.ValueObject {
  kind: AnyKey;
  type: boolean;
  types: Immutable.Set<TypeKey>;
  values: Immutable.Set<TypeVal>;
  or(other: IAny): IAny;
  and(other: IAny): IAny;
}

export interface INever extends IAny {
  kind: "never";
  type: true;
  types: Immutable.Set<never>;
  values: Immutable.Set<never>;
}

export interface IType<K extends TypeKey = TypeKey> extends IAny {
  kind: K;
  type: boolean;
  types: Immutable.Set<K>;
  values: Immutable.Set<TypeVal<K>>;
}

const keys = [
  "null",
  "number",
  "string",
  "boolean",
  "date",
  "duration",
  "link",
  "object",
  "array",
  "tuple",
  "function"
] as const;

class Subtypes extends Immutable.Record<{
  [K in TypeKey]: IType<K> | undefined;
}>(Object.fromEntries(keys.map((key) => [key, undefined])) as any) {
  *keys() {
    for (const [key, _] of this.entries()) {
      yield key;
    }
  }

  *values() {
    for (const [_, value] of this.entries()) {
      yield value;
    }
  }

  *entries() {
    for (const key of keys) {
      const value = this.get(key);

      if (value !== undefined) {
        yield [key, value] as const;
      }
    }
  }

  mergeAll(
    other: Subtypes,
    fn: (l?: IType, r?: IType) => IType | undefined
  ): Subtypes {
    return new Subtypes(
      keys.map((key) => [key, fn(this.get(key), other.get(key))])
    );
  }
}

export interface IUnion extends IAny {
  kind: "union";
  type: true;
  subtypes: Subtypes;
}

abstract class TypeBase<K extends TypeKey> implements IType<K> {
  abstract kind: K;
  abstract type: boolean;
  abstract types: Immutable.Set<K>;
  abstract values: Immutable.Set<TypeVal<K>>;

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

  equals(other: unknown): boolean {
    if (!(other instanceof TypeBase)) {
      return false;
    }

    return this.kind === other.kind && this.values.equals(other.values);
  }

  hashCode(): number {
    return this.values.hashCode();
  }
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
  types: Immutable.Set<K>;

  get type(): boolean {
    return this.values.size !== 1;
  }

  constructor(
    public kind: K,
    public values: Immutable.Set<TypeVal<K>> = Immutable.Set()
  ) {
    super();
    this.types = Immutable.Set([this.kind]);
  }

  from(val: TypeVal<K>, ...vals: TypeVal<K>[]): PrimType<K> {
    return new PrimType(this.kind, Immutable.Set([val, ...vals]));
  }

  protected _or(other: IType<K>): IAny {
    return new PrimType(this.kind, this.values.union(other.values));
  }

  protected _and(other: IType<K>): IAny {
    const vals = this.values.intersect(other.values);

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

  get values(): Immutable.Set<TypeVal> {
    return Immutable.Set(
      [...this.subtypes.values()].flatMap((type) => [...type.values])
    );
  }

  get types(): Immutable.Set<TypeKey> {
    return Immutable.Set(this.subtypes.keys());
  }

  private constructor(public subtypes: Subtypes) {}

  static from(type: IAny, ...types: IAny[]): IUnion | INever {
    return types.reduce(
      (l, r) => l.or(r),
      ["union", "never"].includes(type.kind)
        ? type
        : new Union(new Subtypes({ [type.kind]: type }))
    ) as IUnion | INever;
  }

  or(other: IAny): IAny {
    if (other.kind === "never") {
      return this;
    }

    return new Union(
      this.subtypes.mergeAll((Union.from(other) as Union).subtypes, (l, r) =>
        l && r ? (l.or(r) as IType) : l ? l : r
      )
    );
  }

  and<T extends IAny>(other: T): IAny {
    if (other.kind === "never") {
      return other;
    }

    const res = this.subtypes.mergeAll(
      (Union.from(other) as Union).subtypes,
      (l, r) => (l && r ? (l.and(r) as any) : undefined)
    );

    const vals = [...res.values()];

    switch (vals.length) {
      case 0:
        return Never;
      case 1:
        return vals[0];
      default:
        return new Union(res);
    }
  }

  equals(other: unknown): boolean {
    if (!(other instanceof Union)) {
      return false;
    }

    return this.values.equals(other.values);
  }

  hashCode(): number {
    return this.values.hashCode();
  }
}

// never
export const Never = {
  kind: "never" as const,
  type: true as const,
  types: Immutable.Set<never>(),
  values: Immutable.Set<never>(),

  or(other: IAny): IAny {
    return other;
  },

  and(_other: IAny): IAny {
    return Never;
  },

  equals(other: unknown): boolean {
    return other === Never;
  },

  hashCode(): number {
    return 0x42108424;
  }
};

// object
class ObjectType extends TypeBase<"object"> {
  kind = "object" as const;
  types = Immutable.Set<"object">(["object"]);

  get type() {
    return this.values.size === 0;
  }

  from(...objs: Record<string, IAny>[]): IAny {
    return new ObjectType(Immutable.Set(objs.map((obj) => Immutable.Map(obj))));
  }

  constructor(
    public values: Immutable.Set<Immutable.Map<string, IAny>> = Immutable.Set()
  ) {
    super();
  }

  protected _or(other: IType<"object">): IAny {
    return this.values.equals(other.values) ? this : Union.from(this, other);
  }

  protected _and(other: IType<"object">): IAny {
    throw "todo";
  }
}

const ObjectVal = new ObjectType();
export { ObjectVal as Object };

// array
class ArrayType {} // array<type>

// tuple
class TupleType {} // array<type>

// function
class FunctionType {} // { args: tuple<any>, return: any }
