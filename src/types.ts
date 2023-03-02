import * as I from "immutable";
import * as L from "luxon";

type TypeMap = {
  null: { type: NullType; value: AnyType };
  number: { type: NumberType; value: number | AnyType };
  string: { type: StringType; value: string | AnyType };
  boolean: { type: BooleanType; value: boolean | AnyType };
  date: { type: DateType; value: L.DateTime | AnyType };
  duration: { type: DurationType; value: L.Duration | AnyType };
  link: { type: LinkType; value: string | AnyType };
  object: { type: ObjectType; value: ObjectVal };
  list: { type: ListType; value: ListVal };
  function: { type: FunctionType; value: FunctionVal };
  union: { type: UnionType; value: I.Map<ValueKey, I.Set<ValueType>> };
  any: { type: AnyType; value: "*" };
  error: { type: ErrorType; value: I.Set<ErrorVal> };
};

type SimpleKey =
  | "null"
  | "number"
  | "string"
  | "boolean"
  | "date"
  | "duration"
  | "link";
type CompositeKey = "object" | "list";
type ValueKey = SimpleKey | CompositeKey | "function";
type TypeKey = keyof TypeMap;

type Type<K extends TypeKey = TypeKey> = TypeMap[K]["type"];
type Value<K extends TypeKey = TypeKey> = TypeMap[K]["value"];

type ValueType = Type<ValueKey>;

abstract class TypeBase<K extends TypeKey> implements I.ValueObject {
  static andErrMsg(a: Type, b: Type): string {
    return `Can't combine '${a}' and '${b}'.`;
  }

  constructor(public type: K, public value: Value<K>) {}

  abstract or(other: Type): Type;
  abstract and(other: Type): Type;
  abstract _or(other: Type<K>): Type<K>[];
  abstract _and(other: Type<K>): Type<K>[];

  equals(other: unknown): boolean {
    return (
      other instanceof TypeBase &&
      this.type === other.type &&
      I.is(this.value.valueOf(), other.value.valueOf())
    );
  }

  hashCode(): number {
    return 0x42108460 ^ I.hash(this.type) ^ I.hash(this.value);
  }

  abstract toString(): string;
  abstract toJSON(): unknown;
  abstract isType(): boolean;

  isValue(): boolean {
    return !this.isType();
  }
}

// any
class AnyType extends TypeBase<"any"> {
  constructor() {
    super("any", "*");
  }

  or(_other: Type): Type {
    return $Any;
  }

  and(other: Type): Type {
    return other;
  }

  _or(_other: Type<"any">): [Type<"any">] {
    return [$Any];
  }

  _and(_other: Type<"any">): [Type<"any">] {
    return [$Any];
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
}

const $Any = new AnyType();

// error
class ErrorVal extends I.Record({
  message: "",
  vars: I.Set<string>()
}) {}

class ErrorType extends TypeBase<"error"> {
  constructor(value: Value<"error"> = I.Set()) {
    super("error", value);
  }

  addMessage(message?: string, vars?: string[]): Type<"error"> {
    return message === undefined
      ? $Error
      : new ErrorType(
          this.value.add(new ErrorVal({ message, vars: I.Set(vars || []) }))
        );
  }

  or(other: Type): Type {
    return other;
  }

  and(_other: Type): Type {
    return this;
  }

  _or(other: Type<"error">): [Type<"error">] {
    return [new ErrorType(this.value.union(other.value))];
  }

  _and(other: Type<"error">): [Type<"error">] {
    return [new ErrorType(this.value.union(other.value))];
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

const $Error = new ErrorType();

abstract class ValueBase<K extends ValueKey> extends TypeBase<K> {
  constructor(type: K, value: Value<K>) {
    super(type, value);
  }

  or(other: Type): Type {
    switch (other.type) {
      case "any":
        return $Any;
      case "error":
        return this as Type<K>;
      case "union":
        return other.or(this as Type<K>);
      case this.type:
        return UnionType.from(this._or(other));
      default:
        return UnionType.from([this as Type<K>, other]);
    }
  }

  and(other: Type): Type {
    switch (other.type) {
      case "any":
        return this as Type<K>;
      case "error":
        return other;
      case "union":
        return other.and(this as Type<K>);
      case this.type:
        return UnionType.from(
          this._and(other as Type<K>),
          TypeBase.andErrMsg(this as Type<K>, other)
        );
      default:
        return $Error.addMessage(TypeBase.andErrMsg(this as Type<K>, other));
    }
  }

  abstract _or(other: Type<K>): [Type<K>] | [Type<K>, Type<K>];
  abstract _and(other: Type<K>): [] | [Type<K>];
}

abstract class SimpleBase<K extends SimpleKey> extends ValueBase<K> {
  constructor(type: K, value?: Value<K>) {
    super(type, value === undefined ? $Any : value);
  }

  _or(other: Type<K>): [Type<K>] | [Type<K>, Type<K>] {
    if (this.isType()) {
      return [this as Type<K>];
    }

    if (other.isType()) {
      return [other];
    }

    return I.is(this.value, other.value)
      ? [this as Type<K>]
      : [this as Type<K>, other];
  }

  _and(other: Type<K>): [] | [Type<K>] {
    if (this.isType()) {
      return [other];
    }

    if (other.isType()) {
      return [this as Type<K>];
    }

    return I.is(this.value, other.value) ? [this as Type<K>] : [];
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
    return this.value === $Any;
  }
}

class NullType extends SimpleBase<"null"> {
  constructor() {
    super("null");
  }

  isType(): boolean {
    return false;
  }
}

class NumberType extends SimpleBase<"number"> {
  constructor(value?: Value<"number">) {
    super("number", value);
  }

  literal(value: number): NumberType {
    return new NumberType(value);
  }
}

class StringType extends SimpleBase<"string"> {
  constructor(value?: Value<"string">) {
    super("string", value);
  }

  literal(value: string): StringType {
    return new StringType(value);
  }
}

class BooleanType extends SimpleBase<"boolean"> {
  constructor(value?: Value<"boolean">) {
    super("boolean", value);
  }

  literal(value: boolean): BooleanType {
    return new BooleanType(value);
  }
}

class DateType extends SimpleBase<"date"> {
  constructor(value?: Value<"date">) {
    super("date", value);
  }

  literal(value: L.DateTime): DateType {
    return new DateType(value);
  }
}

class DurationType extends SimpleBase<"duration"> {
  constructor(value?: Value<"duration">) {
    super("duration", value);
  }

  literal(value: L.Duration): DurationType {
    return new DurationType(value);
  }
}

class LinkType extends SimpleBase<"link"> {
  constructor(value?: Value<"link">) {
    super("link", value);
  }

  literal(value: string): LinkType {
    return new LinkType(value);
  }
}

const $Null = new NullType();
const $Number = new NumberType();
const $String = new StringType();
const $Boolean = new BooleanType();
const $Date = new DateType();
const $Duration = new DurationType();
const $Link = new LinkType();

// union
class UnionType extends TypeBase<"union"> {
  private constructor(value: Value<"union">) {
    super("union", value);
  }

  private static new(value: Value<"union">, errMsg?: string): Type {
    return UnionType.shrink(new UnionType(value), errMsg);
  }

  static from(values: ValueType[], errMsg?: string): Type {
    return UnionType.new(
      I.Seq(values)
        .groupBy((v) => v.type)
        .map((v) => v.toSet())
        .toMap(),
      errMsg
    );
  }

  private static shrink(union: Type<"union">, errMsg?: string): Type {
    const size = union.value.map((s) => s.size).reduce((l, r) => l + r, 0);

    switch (size) {
      case 0:
        return $Error.addMessage(errMsg);
      case 1:
        return union.value.first<I.Set<ValueType>>().first<ValueType>();
      default:
        return union;
    }
  }

  _or(other: Type<"union">): [Type<"union">] {
    return [
      new UnionType(
        this.value.mergeWith(
          (ls, rs) => ls.flatMap((l: any) => rs.flatMap((r) => l._or(r))),
          other.value
        )
      )
    ];
  }

  _and(other: Type<"union">): [Type<"union">] {
    return [
      new UnionType(
        I.Set.union<ValueKey>([this.value.keys(), other.value.keys()])
          .toMap()
          .flatMap((k) => {
            const res = this.value
              .get(k, I.Set<ValueType>())
              .flatMap((l: any) =>
                other.value.get(k, I.Set<ValueType>()).flatMap((r) => l._and(r))
              );
            return res.isEmpty() ? [] : [[k, res as any]];
          })
      )
    ];
  }

  or(other: Type): Type {
    if (other.type === "any") {
      return other;
    }

    if (other.type === "error") {
      return this;
    }

    return this._or(
      other.type === "union"
        ? other
        : new UnionType(I.Map([[other.type, I.Set([other])]]))
    )[0];
  }

  and(other: Type<TypeKey>): Type<TypeKey> {
    if (other.type === "any") {
      return this;
    }

    if (other.type === "error") {
      return other;
    }

    return UnionType.shrink(
      this._and(
        other.type === "union"
          ? other
          : new UnionType(I.Map([[other.type, I.Set([other])]]))
      )[0],
      TypeBase.andErrMsg(this, other)
    );
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
              v.value === $Any ? [] : [(v.toJSON() as any).value]
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
}

abstract class CompositeBase<K extends CompositeKey> extends ValueBase<K> {
  protected abstract toLit: () => unknown;
  protected abstract litWrap: [string, string];

  _or(other: Type<K>): [Type<K>] | [Type<K>, Type<K>] {
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
      return [this as unknown as Type<K>, other];
    }

    const nm = this.mappedOr(lm, rm);

    if (nm.size === 1) {
      return [this.new(nu, nm)];
    }

    grew =
      grew |
      (nm.some(
        (nv, k) => !nv.equals((lm as I.Collection<any, Type>).get(k, $Error))
      )
        ? Grew.Left
        : Grew.None);
    grew =
      grew |
      (nm.some(
        (nv, k) => !nv.equals((rm as I.Collection<any, Type>).get(k, $Error))
      )
        ? Grew.Right
        : Grew.None);

    switch (grew) {
      case Grew.None:
      case Grew.Left:
        return [other];
      case Grew.Right:
        return [this as unknown as Type<K>];
      case Grew.Both:
        return [this as unknown as Type<K>, other];
    }
  }

  _and(other: Type<K>): [] | [Type<K>] {
    const { unmapped: lu, mapped: lm } = this.value;
    const { unmapped: ru, mapped: rm } = other.value;

    const nu = lu.and(ru);
    const nm = this.mappedAnd(lm, rm);

    if (
      (nu.type === "error" && nm.isEmpty()) ||
      nm.some((v) => v.type === "error")
    ) {
      return [];
    }

    return [this.new(nu, nm)];
  }

  protected abstract new(unmapped: Type, mapped: Value<K>["mapped"]): Type<K>;

  protected abstract mappedAnd(
    lm: Value<K>["mapped"],
    rm: Value<K>["mapped"]
  ): Value<K>["mapped"];

  protected abstract mappedOr(
    lm: Value<K>["mapped"],
    rm: Value<K>["mapped"]
  ): Value<K>["mapped"];

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

class ObjectVal extends I.Record({
  mapped: I.Map<string, Type>(),
  unmapped: $Error as Type
}) {}

class ListVal extends I.Record({
  mapped: I.List<Type>(),
  unmapped: $Error as Type
}) {}

// object
class ObjectType extends CompositeBase<"object"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toMap();
  protected litWrap: [string, string] = ["{ ", " }"];

  constructor(value: Value<"object"> = new ObjectVal({ unmapped: $Any })) {
    super("object", value);
  }

  protected new(unmapped: Type, mapped: I.Map<any, Type>): ObjectType {
    return new ObjectType(new ObjectVal({ unmapped, mapped }));
  }

  protected mappedOr(
    lm: Value<"object">["mapped"],
    rm: Value<"object">["mapped"]
  ): Value<"object">["mapped"] {
    return lm.mergeWith((l, r) => l.or(r), rm);
  }

  protected mappedAnd(
    lm: Value<"object">["mapped"],
    rm: Value<"object">["mapped"]
  ): Value<"object">["mapped"] {
    return I.Map(
      I.Set.union<string>([lm.keys(), rm.keys()]).flatMap((key) => {
        const val = lm.get(key, $Any).and(rm.get(key, $Any));
        return val.type === "error" ? [] : [[key, val]];
      })
    );
  }

  record(value: Record<string, Type>): Type {
    return new ObjectType(new ObjectVal({ mapped: I.Map(value) }));
  }

  map(value: Type): Type {
    return new ObjectType(new ObjectVal({ unmapped: value }));
  }
}

const $Object = new ObjectType();

// list
class ListType extends CompositeBase<"list"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toArray();
  protected litWrap: [string, string] = ["[", "]"];

  constructor(value: Value<"list"> = new ListVal({ unmapped: $Any })) {
    super("list", value);
  }

  protected new(unmapped: Type, mapped: I.List<Type>): ListType {
    return new ListType(new ListVal({ unmapped, mapped }));
  }

  protected mappedOr(
    lm: Value<"list">["mapped"],
    rm: Value<"list">["mapped"]
  ): Value<"list">["mapped"] {
    return lm
      .zipAll(rm)
      .map(([l, r]) => (l || $Error).or((r || $Error) as Type));
  }

  protected mappedAnd(
    lm: Value<"list">["mapped"],
    rm: Value<"list">["mapped"]
  ): Value<"list">["mapped"] {
    return I.Range(0, Math.max(lm.size, rm.size))
      .flatMap((key) => {
        const val = lm.get(key, $Any).and(rm.get(key, $Any));
        return val.type === "error" ? [] : [val];
      })
      .toList();
  }

  list(value: Type): Type {
    return new ListType(new ListVal({ unmapped: value }));
  }

  tuple(value: Type[]): Type {
    return new ListType(new ListVal({ mapped: I.List(value) }));
  }
}

const $List = new ListType();

class FunctionVal extends I.Record({
  args: I.List<Type>(),
  return: $Error as Type
}) {}

// function
class FunctionType extends TypeBase<"function"> {
  constructor(value: FunctionVal = new FunctionVal()) {
    super("function", value);
  }

  or(_other: Type<TypeKey>): Type<TypeKey> {
    throw new Error("Method not implemented.");
  }
  and(_other: Type<TypeKey>): Type<TypeKey> {
    throw new Error("Method not implemented.");
  }
  _or(_other: Type<"function">): Type<"function">[] {
    throw new Error("Method not implemented.");
  }
  _and(_other: Type<"function">): Type<"function">[] {
    throw new Error("Method not implemented.");
  }
  toString(): string {
    throw new Error("Method not implemented.");
  }
  toJSON(): unknown {
    throw new Error("Method not implemented.");
  }
  isType(): boolean {
    throw new Error("Method not implemented.");
  }
}

const $Function = new FunctionType();

export type IType = Type;

export {
  $Null as Null,
  $Number as Number,
  $String as String,
  $Boolean as Boolean,
  $Date as Date,
  $Duration as Duration,
  $Link as Link,
  $Error as Error,
  $Any as Any,
  $Object as Object,
  $List as List,
  $Function as Function
};

// utility
export function $(
  arg:
    | null
    | number
    | string
    | boolean
    | L.DateTime
    | L.Duration
    | Record<string, Type>
    | Type[]
): Type {
  if (arg === null) {
    return $Null;
  }

  if (typeof arg === "number") {
    return $Number.literal(arg);
  }

  if (typeof arg === "string") {
    return $String.literal(arg);
  }

  if (typeof arg === "boolean") {
    return $Boolean.literal(arg);
  }

  if (arg instanceof L.DateTime) {
    return $Date.literal(arg);
  }

  if (arg instanceof L.Duration) {
    return $Duration.literal(arg);
  }

  if (Array.isArray(arg)) {
    return $List.tuple(arg);
  }

  return $Object.record(arg);
}
