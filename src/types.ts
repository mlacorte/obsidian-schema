import * as I from "immutable";
import * as L from "luxon";

// any
type AnyMap = TypeMap & {
  union: Union;
  any: never;
  never: never;
};
type AnyKey = keyof AnyMap;
type AnyVal<K extends AnyKey> = AnyMap[K];

// type
type TypeMap = PrimMap & {
  object: I.Map<string, IAny>;
  list: I.List<IAny>;
  function: { args: I.List<IAny>; return: IAny };
};
type TypeKey = keyof TypeMap;
type TypeVal<K extends TypeKey = TypeKey> = TypeMap[K];

export interface IAny extends I.ValueObject {
  kind: AnyKey;
  types: I.Set<ITypeOrValue>;
  value?: TypeVal;
  or(other: IAny): IAny;
  and(other: IAny): IAny;
  equals(other: unknown): boolean;
  hashCode(): number;
  toString(): string;
  toJSON(): unknown;
  isType(): this is IType | IUnion | IAlways | INever;
  isValue(): this is IValue;
}

interface IUnion extends IAny {
  kind: "union";
  types: I.Set<ITypeOrValue>;
  value?: undefined;
  isType(): this is IUnion;
  isValue(): false;
}

interface IAlways extends IAny {
  kind: "any";
  types: I.Set<never>;
  value?: undefined;
  isType(): this is IAlways;
  isValue(): false;
}

interface INever extends IAny {
  kind: "never";
  types: I.Set<never>;
  value?: undefined;
  isType(): this is INever;
  isValue(): false;
}

interface ITypeOrValue<K extends TypeKey = TypeKey> extends IAny {
  kind: K;
  type: IType<K>;
  types: I.Set<ITypeOrValue<K>>;
  value?: TypeVal<K>;
  isType(): this is IType<K>;
  isValue(): this is IValue<K>;
}

interface IType<K extends TypeKey = TypeKey> extends ITypeOrValue<K> {
  value?: undefined;
}

interface IValue<K extends TypeKey = TypeKey> extends ITypeOrValue<K> {
  value: AnyVal<K>;
}

abstract class TypeBase<K extends TypeKey> implements ITypeOrValue<K> {
  types: I.Set<ITypeOrValue<K>>;
  abstract type: IType<K>;

  constructor(public kind: K, public value?: TypeVal<K>) {
    this.types = I.Set([this as unknown as ITypeOrValue<K>]);
  }

  or(other: IAny): IAny {
    switch (other.kind) {
      case "any":
        return Any;
      case "never":
        return this;
      case "union":
        return other.or(this);
      case this.kind:
        return this.isType()
          ? this
          : other.isType()
          ? other
          : this._or(other as IValue<K>);
      default:
        return Union.from(this, other);
    }
  }

  and(other: IAny): IAny {
    switch (other.kind) {
      case "any":
        return this;
      case "never":
        return Never;
      case "union":
        return other.and(this);
      case this.kind:
        return this.isType()
          ? other
          : other.isType()
          ? this
          : this._and(other as IValue<K>);
      default:
        return Never;
    }
  }

  protected abstract _or(other: IValue<K>): IAny;
  protected abstract _and(other: IValue<K>): IAny;

  equals(other: unknown): boolean {
    if (!(other instanceof TypeBase) || this.kind !== other.kind) {
      return false;
    }

    return I.is(this.value, other.value);
  }

  hashCode(): number {
    return I.hash(this.kind) ^ I.hash(this.value);
  }

  abstract toString(): string;
  abstract toJSON(): unknown;
  abstract isType(): this is IType<K>;

  isValue(): this is IValue<K> {
    return !this.isType();
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
  type: IType<K>;

  constructor(kind: K, value?: TypeVal<K>) {
    super(kind, value);

    this.type = (this.isType() ? this : new PrimType(kind)) as IType<K>;
  }

  from(val: TypeVal<K>): IAny {
    return new PrimType(this.kind, val);
  }

  protected _or(other: IValue<K>): IAny {
    return this.equals(other) ? this : Union.from(this, other);
  }

  protected _and(other: IValue<K>): IAny {
    return this.equals(other) ? this : Never;
  }

  toString() {
    return this.isType() ? `type(${this.kind})` : JSON.stringify(this.value);
  }

  toJSON() {
    return this.isValue()
      ? { kind: this.kind, value: this.value }
      : { kind: this.kind };
  }

  isType(): this is IType<K> {
    return this.value === undefined;
  }
}

const NullVal = new PrimType("null");
const NumberVal = new PrimType("number");
const StringVal = new PrimType("string");
const BooleanVal = new PrimType("boolean");
const DateVal = new PrimType("date");
const DurationVal = new PrimType("duration");
const LinkVal = new PrimType("link");

// union
class Union implements IUnion {
  kind = "union" as const;

  private constructor(public types: I.Set<ITypeOrValue>) {}

  private static shrink(types: I.Set<ITypeOrValue>): IAny {
    switch (types.size) {
      case 0:
        return Never;
      case 1:
        return types.first() as ITypeOrValue;
      default:
        return new Union(types);
    }
  }

  static from(...types: IAny[]): IAny {
    if (types.includes(Any)) {
      return Any;
    }

    return Union.shrink(
      I.Seq(types)
        .flatMap((type) => type.types)
        .reduce(
          (res, a) =>
            (a.isType()
              ? res.filter((b) => a.kind !== b.kind).asMutable()
              : res
            ).add(a),
          I.Set<ITypeOrValue>().asMutable()
        )
        .asImmutable()
    );
  }

  or(other: IAny): IAny {
    return Union.from(this, other);
  }

  and(other: IAny): IAny {
    if (other === Never) {
      return Never;
    }

    const types = this.types
      .filter((a) => a.isType())
      .intersect(other.types.filter((a) => a.isType()));

    const values = this.types
      .filter((a) => a.isValue())
      .intersect(other.types.filter((a) => a.isValue()));

    return Union.shrink(
      this.types
        .map((a) => a.type)
        .intersect(other.types.map((a) => a.type))
        .flatMap((a) =>
          types.has(a) ? [a] : values.filter((b) => a.kind === b.kind)
        )
    );
  }

  equals(other: unknown): boolean {
    if (!(other instanceof Union)) {
      return false;
    }

    return this.types.equals(other.types);
  }

  hashCode(): number {
    return this.types.hashCode();
  }

  toString() {
    return this.types.map((val) => val.toString()).join(" or ");
  }

  toJSON() {
    return {
      kind: "union",
      types: this.types.map((t) => t.toJSON()).toArray()
    };
  }

  isType(): this is IUnion {
    return true;
  }

  isValue(): false {
    return false;
  }
}

// any
const Any: IAlways = {
  kind: "any" as const,
  types: I.Set<never>(),

  or(_other: IAny): IAny {
    return Any;
  },

  and(other: IAny): IAny {
    return other;
  },

  equals(other: unknown): boolean {
    return other === Any;
  },

  hashCode(): number {
    return 0x42108425;
  },

  toString(): string {
    return "type(any)";
  },

  toJSON(): unknown {
    return "any";
  },

  isType(): true {
    return true;
  },

  isValue(): false {
    return false;
  }
};

// never
const Never: INever = {
  kind: "never" as const,
  types: I.Set<never>(),

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
  },

  toString(): string {
    return "type(never)";
  },

  toJSON(): unknown {
    return "never";
  },

  isType(): true {
    return true;
  },

  isValue(): false {
    return false;
  }
};

abstract class CompositeBase<K extends "object" | "list"> extends TypeBase<K> {
  protected shrink(other: IValue<K>, def: IAny): [boolean, boolean] {
    const lCol = this.value as I.Map<string, IAny> & I.List<IAny>;
    const rCol = other.value as I.Map<string, IAny> & I.List<IAny>;
    const keys = I.Set(lCol.keySeq().concat(rCol.keySeq()));

    let lShrink = false;
    let rShrink = false;

    for (const key of keys.keys()) {
      const l = lCol.get(key, def);
      const r = rCol.get(key, def);
      const s = l.and(r);

      if (lShrink && rShrink) {
        break;
      }

      if (!lShrink) {
        lShrink = l.equals(s) && !r.equals(s);
      }

      if (!rShrink) {
        rShrink = r.equals(s) && !l.equals(s);
      }
    }

    return [lShrink, rShrink];
  }

  protected _or(other: IValue<K>): IAny {
    const [lShrink, rShrink] = this.shrink(other, Never);

    return lShrink && rShrink
      ? Union.from(this, other)
      : rShrink
      ? this
      : other;
  }

  protected _and(other: IValue<K>): IAny {
    const [lShrink, rShrink] = this.shrink(other, Any);

    return lShrink && rShrink
      ? Union.from(this, other)
      : lShrink
      ? this
      : other;
  }

  isType(): this is IType<K> {
    return this.value === undefined || this.value.some((v) => v.isType());
  }
}

// object
class ObjectType extends CompositeBase<"object"> {
  type: IType<"object">;

  constructor(value?: I.Map<string, IAny>) {
    super("object", value);

    this.type = (this.isType() ? this : new ObjectType()) as IType<"object">;
  }

  from(value: Record<string, IAny>): IAny {
    return new ObjectType(I.Map(value));
  }

  toString() {
    return this.isValue() ? JSON.stringify(this.toJSON()) : `type(object)`;
  }

  toJSON() {
    return this.isValue()
      ? { kind: this.kind, value: this.value.map((v) => v.toJSON()).toObject() }
      : { kind: this.kind };
  }
}

const ObjectVal = new ObjectType();

// list
class ListType<T extends IAny> extends CompositeBase<"list"> {
  type: IType<"list">;

  constructor(public subtype: T, value?: I.List<T & IValue>) {
    super("list", value);

    this.type = (this.isType() ? this : new ObjectType()) as IType<"list">;
  }

  from(value: IAny | IAny[]): IAny {
    if (!Array.isArray(value)) {
      return new ListType(value);
    }

    const subtype = Union.from(...value);
    const vals = value.some((v) => v.isType()) ? undefined : I.List(value);

    return new ListType(subtype, vals as any);
  }

  toString() {
    return this.isValue()
      ? JSON.stringify(this.toJSON())
      : `type(list(${this.subtype}))`;
  }

  toJSON() {
    return this.isValue()
      ? { kind: this.kind, value: this.value.map((v) => v.toJSON()).toArray() }
      : { kind: this.kind };
  }
}

const ListVal = new ListType(Any);

// function
class FunctionType {} // { args: tuple<any>, return: any }

const FunctionVal = new FunctionType();

export {
  NullVal as Null,
  NumberVal as Number,
  StringVal as String,
  BooleanVal as Boolean,
  DateVal as Date,
  DurationVal as Duration,
  LinkVal as Link,
  Never as Never,
  Any as Any,
  Union as Union,
  ObjectVal as Object,
  ListVal as List,
  FunctionVal as Function
};
