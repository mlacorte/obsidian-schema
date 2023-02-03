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

const empty = ISet<any>();

// any
type AnyMap = TypeMap & {
  union: Union;
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
  isType(): this is IType | IUnion | INever;
  isValue(): this is IValue;
}

export interface IUnion extends IAny {
  kind: "union";
  types: ISet<ITypeOrValue>;
  value?: undefined;
  isType(): true;
  isValue(): false;
}

export interface INever extends IAny {
  kind: "never";
  types: ISet<never>;
  value?: undefined;
  isType(): true;
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
  isType(): true;
  isValue(): false;
}

export interface IValue<K extends TypeKey = TypeKey> extends ITypeOrValue<K> {
  value: AnyVal<K>;
  isType(): false;
  isValue(): true;
}

abstract class TypeBase<K extends TypeKey> implements ITypeOrValue<K> {
  types: ISet<ITypeOrValue<K>>;
  abstract type: IType<K>;

  constructor(public kind: K, public value?: TypeVal<K>) {
    this.types = ISet([this as unknown as ITypeOrValue<K>]);
  }

  or(other: IAny): IAny {
    switch (other.kind) {
      case "never":
        return Never;
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

  toString() {
    return this.isType() ? `type(${this.kind})` : JSON.stringify(this.value);
  }

  toJSON() {
    return this.isValue()
      ? { kind: this.kind, value: this.value }
      : { kind: this.kind };
  }

  isType() {
    return this.value === undefined;
  }

  isValue() {
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
      types: this.types.toJS()
    };
  }

  isType(): true {
    return true;
  }

  isValue(): false {
    return false;
  }
}

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

  isType() {
    return true;
  },

  isValue() {
    return false;
  }
};

// object
class ObjectType {} // map<string, type>

// array
class ArrayType {} // array<type>

// tuple
class TupleType {} // array<type>

// function
class FunctionType {} // { args: tuple<any>, return: any }

export {
  NullVal as Null,
  NumberVal as Number,
  StringVal as String,
  BooleanVal as Boolean,
  DateVal as Date,
  DurationVal as Duration,
  LinkVal as Link,
  Never as Never,
  Union as Union
};
