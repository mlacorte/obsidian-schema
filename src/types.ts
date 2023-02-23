import * as I from "immutable";
import * as L from "luxon";

type SimpleVals = {
  null: null;
  number: number | null;
  string: string | null;
  boolean: boolean | null;
  date: L.DateTime | null;
  duration: L.Duration | null;
  link: string | null;
};
type CompositeVals = {
  object: I.RecordOf<{ mapped: I.Map<any, IType>; unmapped: IType }>;
  list: I.RecordOf<{ mapped: I.Map<any, IType>; unmapped: IType }>;
  function: I.RecordOf<{ args: I.List<IType>; return: IType }>;
};
type SpecialVals = {
  union: I.Map<ValueKey, I.Set<IValue>>;
  any: null;
  never: null;
};
type TypeVals = SimpleVals & CompositeVals & SpecialVals;

type SimpleKey = keyof SimpleVals;
type CompositeKey = keyof CompositeVals;
type SpecialKey = keyof SpecialVals;
type ValueKey = SimpleKey | CompositeKey;
type TypeKey = ValueKey | SpecialKey;

type ValueOf<K extends keyof TypeVals> = TypeVals[K];

export interface IType<K extends TypeKey = TypeKey> extends I.ValueObject {
  type: K;
  value: ValueOf<K>;
  or(other: IType): IType;
  and(other: IType): IType;
  _or(other: IType<K>): IType<K>[];
  _and(other: IType<K>): IType<K>[];
  equals(other: unknown): boolean;
  hashCode(): number;
  toString(): string;
  toJSON(): unknown;
  isType(): boolean;
  isValue(): boolean;
}

type IValue = IType<ValueKey>;

abstract class ValueBase<K extends ValueKey> implements IType<K> {
  constructor(public type: K, public value: ValueOf<K>) {}

  or(other: IType): IType {
    switch (other.type) {
      case "any":
        return TAny;
      case "never":
        return this;
      case "union":
        return other.or(this);
      case this.type:
        return UnionType.from(this._or(other as IType<K>));
      default:
        return UnionType.from([this as IValue, other as IValue]);
    }
  }

  and(other: IType): IType {
    switch (other.type) {
      case "any":
        return this;
      case "never":
        return TNever;
      case "union":
        return other.and(this);
      case this.type:
        return UnionType.from(this._and(other as IType<K>));
      default:
        return TNever;
    }
  }

  abstract _or(other: IType<K>): [IType<K>] | [IType<K>, IType<K>];
  abstract _and(other: IType<K>): [] | [IType<K>];

  equals(other: unknown): boolean {
    if (!(other instanceof ValueBase) || this.type !== other.type) {
      return false;
    }

    return I.is(this.value, other.value);
  }

  hashCode(): number {
    return I.hash(this.type) ^ I.hash(this.value);
  }

  abstract toString(): string;
  abstract toJSON(): unknown;
  abstract isType(): boolean;

  isValue(): boolean {
    return !this.isType();
  }
}

class SimpleType<K extends SimpleKey> extends ValueBase<K> {
  constructor(type: K, value?: ValueOf<K>) {
    super(type, value === undefined ? null : value);
  }

  literal(val: ValueOf<K>): IType<K> {
    return new SimpleType(this.type, val);
  }

  _or(other: IType<K>): [IType<K>] | [IType<K>, IType<K>] {
    if (this.isType()) {
      return [this];
    }

    if (other.isType()) {
      return [other];
    }

    return I.is(this.value, other.value) ? [this] : [this, other];
  }

  _and(other: IType<K>): [] | [IType<K>] {
    if (this.isType()) {
      return [other];
    }

    if (other.isType()) {
      return [this];
    }

    return I.is(this.value, other.value) ? [this] : [];
  }

  toString() {
    return this.isType() ? this.type : JSON.stringify(this.value);
  }

  toJSON() {
    return this.isValue()
      ? { type: this.type, value: this.value }
      : { type: this.type };
  }

  isType(): boolean {
    return this.type === "null" ? false : this.value === null;
  }
}

const TNull = new SimpleType("null");
const TNumber = new SimpleType("number");
const TString = new SimpleType("string");
const TBoolean = new SimpleType("boolean");
const TDate = new SimpleType("date");
const TDuration = new SimpleType("duration");
const TLink = new SimpleType("link");

// union
class UnionType implements IType<"union"> {
  type = "union" as const;

  private constructor(public value: ValueOf<"union">) {}

  static new(value: ValueOf<"union">): IType {
    return UnionType.shrink(new UnionType(value));
  }

  static from(values: IValue[]): IType {
    return UnionType.new(
      I.Seq(values)
        .groupBy((v) => v.type)
        .map((v) => v.toSet())
        .toMap()
    );
  }

  private static shrink(union: IType<"union">): IType {
    const size = union.value.map((s) => s.size).reduce((l, r) => l + r, 0);

    switch (size) {
      case 0:
        return TNever;
      case 1:
        return union.value.first<I.Set<IValue>>().first<IValue>();
      default:
        return union;
    }
  }

  _or(other: IType<"union">): [IType<"union">] {
    return [
      new UnionType(
        this.value.mergeWith(
          (ls, rs) => ls.flatMap((l) => rs.flatMap((r) => l._or(r))),
          other.value
        )
      )
    ];
  }

  _and(other: IType<"union">): [IType<"union">] {
    return [
      new UnionType(
        I.Set.union<ValueKey>([this.value.keys(), other.value.keys()])
          .toMap()
          .flatMap((k) => {
            const res = this.value
              .get(k, I.Set<IValue>())
              .flatMap((l) =>
                other.value.get(k, I.Set<IValue>()).flatMap((r) => l._and(r))
              );
            return res.isEmpty() ? [] : [[k, res]];
          })
      )
    ];
  }

  or(other: IType): IType {
    if (other.type === "any") {
      return other;
    }

    if (other.type === "never") {
      return this;
    }

    return UnionType.shrink(
      this._or(
        other.type === "union"
          ? (other as IType<"union">)
          : new UnionType(I.Map([[other.type, I.Set([other as IValue])]]))
      )[0]
    );
  }

  and(other: IType<TypeKey>): IType<TypeKey> {
    if (other.type === "any") {
      return this;
    }

    if (other.type === "never") {
      return other;
    }

    return UnionType.shrink(
      this._and(
        other.type === "union"
          ? (other as IType<"union">)
          : new UnionType(I.Map([[other.type, I.Set([other as IValue])]]))
      )[0]
    );
  }

  equals(other: unknown): boolean {
    if (!(other instanceof UnionType)) {
      return false;
    }

    return this.type === "union" && this.value.equals(other.value);
  }

  hashCode(): number {
    return I.hash(this.type) ^ this.value.hashCode();
  }

  toString() {
    return this.value.map((val) => val.toString()).join(" or ");
  }

  toJSON() {
    return {
      type: "union",
      value: this.value
        .map((s) =>
          s
            .flatMap((v) =>
              v.value === null ? [] : [(v.toJSON() as any).value]
            )
            .toArray()
            .sort()
        )
        .toObject()
    };
  }

  isType(): true {
    return true;
  }

  isValue(): false {
    return false;
  }
}

class AnyType implements IType<"any"> {
  type = "any" as const;
  value = null;

  or(_other: IType): IType {
    return TAny;
  }

  and(other: IType): IType {
    return other;
  }

  _or(_other: IType<"any">): [IType<"any">] {
    return [TAny];
  }

  _and(_other: IType<"any">): [IType<"any">] {
    return [TAny];
  }

  equals(other: unknown): boolean {
    return other instanceof AnyType;
  }

  hashCode(): number {
    return 0x42108425;
  }

  toString(): string {
    return "any";
  }

  toJSON(): unknown {
    return { type: "any" };
  }

  isType(): true {
    return true;
  }

  isValue(): false {
    return false;
  }
}

const TAny = new AnyType();

// never
class NeverType implements IType<"never"> {
  type = "never" as const;
  value = null;

  or(other: IType): IType {
    return other;
  }

  and(_other: IType): IType {
    return TNever;
  }

  _or(_other: IType<"never">): [IType<"never">] {
    return [TNever];
  }

  _and(_other: IType<"never">): [IType<"never">] {
    return [TNever];
  }

  equals(other: unknown): boolean {
    return other instanceof NeverType;
  }

  hashCode(): number {
    return 0x42108424;
  }

  toString(): string {
    return "never";
  }

  toJSON(): unknown {
    return { type: "never" };
  }

  isType(): true {
    return true;
  }

  isValue(): false {
    return false;
  }
}

const TNever = new NeverType();

const CompositeVal = I.Record({
  mapped: I.Map<any, IType>(),
  unmapped: TNever as IType
});

abstract class CompositeBase<K extends "object" | "list"> extends ValueBase<K> {
  protected abstract toLit: () => unknown;
  protected abstract litWrap: [string, string];

  _or(other: IType<K>): [IType<K>] | [IType<K>, IType<K>] {
    const enum Grew {
      None = 0,
      Left = 1,
      Right = 2,
      Both = 3
    }

    const { unmapped: lu, mapped: lm } = this.value;
    const { unmapped: ru, mapped: rm } = other.value;

    let grew = Grew.None;

    const nu = lu.or(ru);

    grew = grew | (!nu.equals(lu) ? Grew.Left : Grew.None);
    grew = grew | (!nu.equals(ru) ? Grew.Right : Grew.None);

    if (grew === Grew.Both) {
      return [this, other];
    }

    const nm = lm.mergeWith((l, r) => l.or(r), rm);

    if (nm.size === 1) {
      return [this.new(nu, nm)];
    }

    grew =
      grew |
      (nm.some((nv, k) => !nv.equals(lm.get(k, TNever)))
        ? Grew.Left
        : Grew.None);
    grew =
      grew |
      (nm.some((nv, k) => !nv.equals(rm.get(k, TNever)))
        ? Grew.Right
        : Grew.None);

    switch (grew) {
      case Grew.None:
      case Grew.Left:
        return [other];
      case Grew.Right:
        return [this];
      case Grew.Both:
        return [this, other];
    }
  }

  _and(other: IType<K>): [] | [IType<K>] {
    const { unmapped: lu, mapped: lm } = this.value;
    const { unmapped: ru, mapped: rm } = other.value;

    const nu = lu.and(ru);
    const nm = I.Set.union<any>([lm.keys(), rm.keys()])
      .toMap()
      .map((k) => lm.get(k, TAny).and(rm.get(k, TAny)));

    if (
      (nu.type === "never" && nm.isEmpty()) ||
      nm.some((v) => v.type === "never")
    ) {
      return [];
    }

    return [this.new(nu, nm)];
  }

  protected abstract new(
    unmapped: IType,
    mapped: I.Map<any, IType>
  ): CompositeBase<K>;

  isType(): boolean {
    return (
      !this.value.unmapped.equals(TNever) ||
      this.value.mapped.some((t) => t.isType())
    );
  }

  toString(): string {
    const { mapped: m, unmapped: u } = this.value;
    const typeStr = u.equals(TAny) ? this.type : `${this.type}(${u})`;

    if (m.isEmpty()) {
      return typeStr;
    }

    const appendStr = m.equals(TNever) ? "" : `, ...${u}`;

    return `${this.litWrap[0]}${m
      .map((v, k) => `${k}: ${v}`)
      .join(", ")}${appendStr}${this.litWrap[1]}`;
  }

  toJSON() {
    const { mapped: m, unmapped: u } = this.value;
    const value: Record<string, unknown> = {};

    if (!m.isEmpty()) {
      value.mapped = this.toLit();
    }

    if (!u.equals(TNever)) {
      value.unmapped = u.toJSON();
    }

    return { type: this.type, value };
  }
}

// object
class ObjectType extends CompositeBase<"object"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toMap();
  protected litWrap: [string, string] = ["{ ", " }"];

  constructor(value: ValueOf<"object"> = CompositeVal({ unmapped: TAny })) {
    super("object", value);
  }

  protected new(unmapped: IType, mapped: I.Map<any, IType>): ObjectType {
    return new ObjectType(CompositeVal({ unmapped, mapped }));
  }

  record(value: Record<string, IType>): IType {
    return new ObjectType(CompositeVal({ mapped: I.Map(value) }));
  }

  map(value: IType): IType {
    return new ObjectType(CompositeVal({ unmapped: value }));
  }
}

const TObject = new ObjectType();

// list
class ListType extends CompositeBase<"list"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toArray();
  protected litWrap: [string, string] = ["[", "]"];

  constructor(value: ValueOf<"list"> = CompositeVal({ unmapped: TAny })) {
    super("list", value);
  }

  protected new(unmapped: IType, mapped: I.Map<any, IType>): ListType {
    return new ListType(CompositeVal({ unmapped, mapped }));
  }

  list(value: IType): IType {
    return new ListType(CompositeVal({ unmapped: value }));
  }

  tuple(value: IType[]): IType {
    return new ListType(CompositeVal({ mapped: I.List(value).toMap() }));
  }
}

const TList = new ListType();

// function
class FunctionType {} // { args: tuple<any>, return: any }

const TFunction = new FunctionType();

export {
  TNull as Null,
  TNumber as Number,
  TString as String,
  TBoolean as Boolean,
  TDate as Date,
  TDuration as Duration,
  TLink as Link,
  TNever as Never,
  TAny as Any,
  TObject as Object,
  TList as List,
  TFunction as Function
};
