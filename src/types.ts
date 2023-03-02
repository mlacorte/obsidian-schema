import * as I from "immutable";
import * as L from "luxon";

type MappedVal<K extends "object" | "list"> = K extends "object"
  ? I.Map<string, IType>
  : I.List<IType>;

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
  object: I.RecordOf<{ mapped: MappedVal<"object">; unmapped: IType }>;
  list: I.RecordOf<{ mapped: MappedVal<"list">; unmapped: IType }>;
  function: I.RecordOf<{ args: I.List<IType>; return: IType }>;
};
type SpecialVals = {
  union: I.Map<ValueKey, I.Set<IValue>>;
  any: null;
  error: I.Set<I.RecordOf<{ message: string; vars: I.Set<string> }>>;
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
      case "error":
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
      case "error":
        return other;
      case "union":
        return other.and(this);
      case this.type:
        return UnionType.from(
          this._and(other as IType<K>),
          twoValErrMsg(this, other)
        );
      default:
        return TError.addMessage(twoValErrMsg(this, other));
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

const twoValErrMsg = (a: IType, b: IType): string =>
  `Can't combine '${a}' and '${b}'.`;

// union
class UnionType implements IType<"union"> {
  type = "union" as const;

  private constructor(public value: ValueOf<"union">) {}

  private static new(value: ValueOf<"union">, errMsg?: string): IType {
    return UnionType.shrink(new UnionType(value), errMsg);
  }

  static from(values: IValue[], errMsg?: string): IType {
    return UnionType.new(
      I.Seq(values)
        .groupBy((v) => v.type)
        .map((v) => v.toSet())
        .toMap(),
      errMsg
    );
  }

  private static shrink(union: IType<"union">, errMsg?: string): IType {
    const size = union.value.map((s) => s.size).reduce((l, r) => l + r, 0);

    switch (size) {
      case 0:
        return TError.addMessage(errMsg);
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

    if (other.type === "error") {
      return this;
    }

    return this._or(
      other.type === "union"
        ? (other as IType<"union">)
        : new UnionType(I.Map([[other.type, I.Set([other as IValue])]]))
    )[0];
  }

  and(other: IType<TypeKey>): IType<TypeKey> {
    if (other.type === "any") {
      return this;
    }

    if (other.type === "error") {
      return other;
    }

    return UnionType.shrink(
      this._and(
        other.type === "union"
          ? (other as IType<"union">)
          : new UnionType(I.Map([[other.type, I.Set([other as IValue])]]))
      )[0],
      twoValErrMsg(this, other)
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

// any
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

const ErrorVal = I.Record({
  message: "",
  vars: I.Set<string>()
});

// error
class ErrorType implements IType<"error"> {
  type = "error" as const;

  constructor(public value: ValueOf<"error"> = I.Set()) {}

  addMessage(message?: string, vars?: string[]): IType<"error"> {
    return message === undefined
      ? TError
      : new ErrorType(
          this.value.add(ErrorVal({ message, vars: I.Set(vars || []) }))
        );
  }

  or(other: IType): IType {
    return other;
  }

  and(_other: IType): IType {
    return this;
  }

  _or(other: IType<"error">): [IType<"error">] {
    return [new ErrorType(this.value.union(other.value))];
  }

  _and(other: IType<"error">): [IType<"error">] {
    return [new ErrorType(this.value.union(other.value))];
  }

  equals(other: unknown): boolean {
    return other instanceof ErrorType && this.value.equals(other.value);
  }

  hashCode(): number {
    return 0x42108424;
  }

  toString(): string {
    if (this.value.size === 0) {
      return "error";
    }

    return this.value
      .toSeq()
      .map((v) => {
        const message = JSON.stringify(v.message);
        const vars = v.vars.isEmpty() ? `, [${v.vars.join(", ")}]` : "";
        return `error(${message}${vars})`;
      })
      .join(" and ");
  }

  toJSON(): unknown {
    return {
      type: "error",
      value: this.value
        .toArray()
        .map((v) => ({ message: v.message, vars: v.vars.toArray() }))
    };
  }

  isType(): true {
    return true;
  }

  isValue(): false {
    return false;
  }
}

const TError = new ErrorType();

const ObjectVal = I.Record({
  mapped: I.Map<any, IType>(),
  unmapped: TError as IType
});

const ListVal = I.Record({
  mapped: I.List<IType>(),
  unmapped: TError as IType
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

    const nm = this.mappedOr(lm as any, rm as any);

    if (nm.size === 1) {
      return [this.new(nu, nm)];
    }

    grew =
      grew |
      (nm.some(
        (nv, k) => !nv.equals((lm as I.Collection<any, IType>).get(k, TError))
      )
        ? Grew.Left
        : Grew.None);
    grew =
      grew |
      (nm.some(
        (nv, k) => !nv.equals((rm as I.Collection<any, IType>).get(k, TError))
      )
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
    const nm = this.mappedAnd(lm as any, rm as any);

    if (
      (nu.type === "error" && nm.isEmpty()) ||
      nm.some((v) => v.type === "error")
    ) {
      return [];
    }

    return [this.new(nu, nm)];
  }

  protected abstract new(
    unmapped: IType,
    mapped: MappedVal<K>
  ): CompositeBase<K>;

  protected abstract mappedAnd(
    lm: MappedVal<K>,
    rm: MappedVal<K>
  ): MappedVal<K>;
  protected abstract mappedOr(lm: MappedVal<K>, rm: MappedVal<K>): MappedVal<K>;

  isType(): boolean {
    return (
      !(this.value.unmapped.type === "error") ||
      this.value.mapped.some((t) => t.isType())
    );
  }

  toString(): string {
    const { mapped: m, unmapped: u } = this.value;
    const typeStr = u.type === "any" ? this.type : `${this.type}(${u})`;

    if (m.isEmpty()) {
      return typeStr;
    }

    const appendStr = m.isEmpty() ? "" : `, ...${u}`;

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

    if (!(u.type === "error")) {
      value.unmapped = u.toJSON();
    }

    return { type: this.type, value };
  }
}

// object
class ObjectType extends CompositeBase<"object"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toMap();
  protected litWrap: [string, string] = ["{ ", " }"];

  constructor(value: ValueOf<"object"> = ObjectVal({ unmapped: TAny })) {
    super("object", value);
  }

  protected new(unmapped: IType, mapped: I.Map<any, IType>): ObjectType {
    return new ObjectType(ObjectVal({ unmapped, mapped }));
  }

  protected mappedOr(
    lm: MappedVal<"object">,
    rm: MappedVal<"object">
  ): MappedVal<"object"> {
    return lm.mergeWith((l, r) => l.or(r), rm);
  }

  protected mappedAnd(
    lm: MappedVal<"object">,
    rm: MappedVal<"object">
  ): MappedVal<"object"> {
    return I.Map(
      I.Set.union<string>([lm.keys(), rm.keys()]).flatMap((key) => {
        const val = lm.get(key, TAny).and(rm.get(key, TAny));
        return val.type === "error" ? [] : [[key, val]];
      })
    );
  }

  record(value: Record<string, IType>): IType {
    return new ObjectType(ObjectVal({ mapped: I.Map(value) }));
  }

  map(value: IType): IType {
    return new ObjectType(ObjectVal({ unmapped: value }));
  }
}

const TObject = new ObjectType();

// list
class ListType extends CompositeBase<"list"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toArray();
  protected litWrap: [string, string] = ["[", "]"];

  constructor(value: ValueOf<"list"> = ListVal({ unmapped: TAny })) {
    super("list", value);
  }

  protected new(unmapped: IType, mapped: I.List<IType>): ListType {
    return new ListType(ListVal({ unmapped, mapped }));
  }

  protected mappedOr(
    lm: MappedVal<"list">,
    rm: MappedVal<"list">
  ): MappedVal<"list"> {
    return lm
      .zipAll(rm)
      .map(([l, r]) => (l || TError).or((r || TError) as IType));
  }

  protected mappedAnd(
    lm: MappedVal<"list">,
    rm: MappedVal<"list">
  ): MappedVal<"list"> {
    return I.Range(0, Math.max(lm.size, rm.size))
      .flatMap((key) => {
        const val = lm.get(key, TAny).and(rm.get(key, TAny));
        return val.type === "error" ? [] : [val];
      })
      .toList();
  }

  list(value: IType): IType {
    return new ListType(ListVal({ unmapped: value }));
  }

  tuple(value: IType[]): IType {
    return new ListType(ListVal({ mapped: I.List(value) }));
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
  TError as Error,
  TAny as Any,
  TObject as Object,
  TList as List,
  TFunction as Function
};

// utility
type Prim =
  | null
  | number
  | string
  | boolean
  | L.DateTime
  | L.Duration
  | Record<string, IType>
  | IType[];

export function $(arg: Prim): IType {
  if (arg === null) {
    return TNull;
  }

  if (typeof arg === "number") {
    return TNumber.literal(arg);
  }

  if (typeof arg === "string") {
    return TString.literal(arg);
  }

  if (typeof arg === "boolean") {
    return TBoolean.literal(arg);
  }

  if (arg instanceof L.DateTime) {
    return TDate.literal(arg);
  }

  if (arg instanceof L.Duration) {
    return TDuration.literal(arg);
  }

  if (Array.isArray(arg)) {
    return TList.tuple(arg);
  }

  return TObject.record(arg);
}

export function $$(...args: Prim[]): IType[] {
  return args.map((arg) => $(arg));
}

export function _(arg: Prim): unknown {
  return $(arg).toJSON();
}

export function __(...args: Prim[]): unknown[] {
  return args.map((arg) => $(arg).toJSON());
}
