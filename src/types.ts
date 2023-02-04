import {
  hash,
  is,
  List as IList,
  Map as IMap,
  Seq,
  Set as ISet,
  ValueObject
} from "immutable";
import { DateTime as LDateTime, Duration as LDuration } from "luxon";

// any
type AnyMap = TypeMap & {
  union: Union;
  always: never;
  never: never;
};
type AnyKey = keyof AnyMap;
type AnyVal<K extends AnyKey> = AnyMap[K];

// type
type TypeMap = PrimMap & {
  object: IMap<string, IAny>;
  array: IList<IAny>;
  tuple: IList<IAny>;
  function: { args: IList<IAny>; return: IAny };
};
type TypeKey = keyof TypeMap;
type TypeVal<K extends TypeKey = TypeKey> = TypeMap[K];

export interface IAny extends ValueObject {
  kind: AnyKey;
  types: ISet<ITypeOrValue>;
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

export interface IUnion extends IAny {
  kind: "union";
  types: ISet<ITypeOrValue>;
  value?: undefined;
  isType(): this is IUnion;
  isValue(): false;
}

export interface IAlways extends IAny {
  kind: "always";
  types: ISet<never>;
  value?: undefined;
  isType(): this is IAlways;
  isValue(): false;
}

export interface INever extends IAny {
  kind: "never";
  types: ISet<never>;
  value?: undefined;
  isType(): this is INever;
  isValue(): false;
}

export interface ITypeOrValue<K extends TypeKey = TypeKey> extends IAny {
  kind: K;
  type: IType<K>;
  types: ISet<ITypeOrValue<K>>;
  value?: TypeVal<K>;
  isType(): this is IType<K>;
  isValue(): this is IValue<K>;
}

export interface IType<K extends TypeKey = TypeKey> extends ITypeOrValue<K> {
  value?: undefined;
}

export interface IValue<K extends TypeKey = TypeKey> extends ITypeOrValue<K> {
  value: AnyVal<K>;
}

export type IObject = ITypeOrValue<"object">;

abstract class TypeBase<K extends TypeKey> implements ITypeOrValue<K> {
  types: ISet<ITypeOrValue<K>>;
  abstract type: IType<K>;

  constructor(public kind: K, public value?: TypeVal<K>) {
    this.types = ISet([this as unknown as ITypeOrValue<K>]);
  }

  or(other: IAny): IAny {
    switch (other.kind) {
      case "always":
        return Always;
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
      case "always":
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

    return is(this.value, other.value);
  }

  hashCode(): number {
    return hash(this.kind) ^ hash(this.value);
  }

  abstract toString(): string;
  abstract toJSON(): unknown;

  isType(): this is IType<K> {
    return this.value === undefined;
  }

  isValue(): this is IValue<K> {
    return this.value !== undefined;
  }
}

// prim
type PrimMap = {
  null: null;
  number: number;
  string: string;
  boolean: boolean;
  date: LDateTime;
  duration: LDuration;
  link: string;
};
type PrimKey = keyof PrimMap;

class PrimType<K extends PrimKey> extends TypeBase<K> {
  type: IType<K>;

  constructor(kind: K, value?: TypeVal<K>) {
    super(kind, value);

    this.type = (this.isType() ? this : new PrimType(kind)) as IType<K>;
  }

  from(val: TypeVal<K>): PrimType<K> {
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

  private constructor(public types: ISet<ITypeOrValue>) {}

  private static shrink(types: ISet<ITypeOrValue>): IAny {
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
    if (types.includes(Always)) {
      return Always;
    }

    return Union.shrink(
      Seq(types)
        .flatMap((type) => type.types)
        .reduce(
          (res, a) =>
            (a.isType()
              ? res.filter((b) => a.kind !== b.kind).asMutable()
              : res
            ).add(a),
          ISet<ITypeOrValue>().asMutable()
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

// always
const Always: IAlways = {
  kind: "always" as const,
  types: ISet<never>(),

  or(_other: IAny): IAny {
    return Always;
  },

  and(other: IAny): IAny {
    return other;
  },

  equals(other: unknown): boolean {
    return other === Always;
  },

  hashCode(): number {
    return 0x42108425;
  },

  toString(): string {
    return "any";
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
  types: ISet<never>(),

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
    return "never";
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

// object
class ObjectType extends TypeBase<"object"> implements IObject {
  type: IType<"object">;

  constructor(value?: IMap<string, IAny>) {
    super("object", value);

    this.type = (this.isType() ? this : new ObjectType()) as IType<"object">;
  }

  from(value: Record<string, IAny>): IAny {
    return new ObjectType(IMap(value));
  }

  private shrink(other: IValue<"object">, def: IAny): [boolean, boolean] {
    const lMap = this.value as IMap<string, IAny>;
    const rMap = other.value;
    const keys = ISet(lMap.keySeq().concat(rMap.keySeq()));

    let lShrink = false;
    let rShrink = false;

    for (const key of keys.keys()) {
      const l = lMap.get(key, def);
      const r = rMap.get(key, def);
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

  protected _or(other: IValue<"object">): IAny {
    const [lShrink, rShrink] = this.shrink(other, Never);

    return lShrink && rShrink
      ? Union.from(this, other)
      : rShrink
      ? this
      : other;
  }

  protected _and(other: IValue<"object">): IAny {
    const [lShrink, rShrink] = this.shrink(other, Always);

    return lShrink && rShrink
      ? Union.from(this, other)
      : lShrink
      ? this
      : other;
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

// array
class ArrayType {} // array<type>

const ArrayVal = new ArrayType();

// tuple
class TupleType {} // array<type>

const TupleVal = new TupleType();

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
  Always as Always,
  Union as Union,
  ObjectVal as Object,
  ArrayVal as Array,
  TupleVal as Tuple,
  FunctionVal as Function
};
