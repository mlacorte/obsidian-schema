import * as I from "immutable";
import * as L from "luxon";
import { Link, Widget } from "obsidian-dataview";

type TypeMap = {
  null: { type: NullType; value: null };
  number: { type: NumberType; value: number | AnyType };
  string: { type: StringType; value: string | AnyType };
  boolean: { type: BooleanType; value: boolean | AnyType };
  date: { type: DateType; value: L.DateTime | AnyType };
  duration: { type: DurationType; value: L.Duration | AnyType };
  link: { type: LinkType; value: Link | AnyType };
  widget: { type: WidgetType; value: Widget | AnyType };
  object: { type: ObjectType; value: ObjectVal };
  array: { type: ArrayType; value: ArrayVal };
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
  | "link"
  | "widget";
type CompositeKey = "object" | "array";
type ValueKey = SimpleKey | CompositeKey | "function";
type TypeKey = keyof TypeMap;

type TypeOf<K extends TypeKey = TypeKey> = TypeMap[K]["type"];
type ValueOf<K extends TypeKey> = TypeMap[K]["value"];

export type Type = TypeOf<TypeKey>;
type ValueType = TypeOf<ValueKey>;

abstract class TypeBase<K extends TypeKey> implements I.ValueObject {
  static andErrMsg(a: Type, b: Type): string {
    return `Can't combine '${a}' and '${b}'.`;
  }

  constructor(public type: K, public value: ValueOf<K>) {}

  abstract or(other: Type): Type;
  abstract and(other: Type): Type;
  protected abstract _or(other: TypeOf<K>): TypeOf<K>[];
  protected abstract _and(other: TypeOf<K>): TypeOf<K>[];

  equals(other: unknown): boolean {
    return (
      other instanceof TypeBase &&
      this.type === other.type &&
      this._equals(other as TypeOf<K>)
    );
  }

  abstract _equals(other: TypeOf<K>): boolean;

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

  _or(_other: AnyType): [AnyType] {
    return [$Any];
  }

  _and(_other: AnyType): [AnyType] {
    return [$Any];
  }

  _equals(_other: AnyType): boolean {
    return true;
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
  constructor(value: ValueOf<"error"> = I.Set()) {
    super("error", value);
  }

  addMessage(message?: string, vars?: string[]): TypeOf<"error"> {
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

  _or(other: ErrorType): [ErrorType] {
    return [new ErrorType(this.value.union(other.value))];
  }

  _and(other: ErrorType): [ErrorType] {
    return [new ErrorType(this.value.union(other.value))];
  }

  _equals(other: ErrorType): boolean {
    return this.value.equals(other.value);
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
  constructor(type: K, value: ValueOf<K>) {
    super(type, value);
  }

  or(other: Type): Type {
    switch (other.type) {
      case "any":
        return $Any;
      case "error":
        return this as unknown as TypeOf<K>;
      case "union":
        return other.or(this as unknown as TypeOf<K>);
      case this.type:
        return UnionType.from(this._or(other));
      default:
        return UnionType.from([this as unknown as TypeOf<K>, other]);
    }
  }

  and(other: Type): Type {
    switch (other.type) {
      case "any":
        return this as unknown as TypeOf<K>;
      case "error":
        return other;
      case "union":
        return other.and(this as unknown as TypeOf<K>);
      case this.type:
        return UnionType.from(
          this._and(other as TypeOf<K>),
          TypeBase.andErrMsg(this as unknown as TypeOf<K>, other)
        );
      default:
        return $Error.addMessage(
          TypeBase.andErrMsg(this as unknown as TypeOf<K>, other)
        );
    }
  }

  abstract _or(other: TypeOf<K>): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>];
  abstract _and(other: TypeOf<K>): [] | [TypeOf<K>];
}

abstract class SimpleBase<K extends SimpleKey> extends ValueBase<K> {
  constructor(type: K, value?: ValueOf<K>) {
    super(type, value === undefined ? $Any : value);
  }

  _or(other: TypeOf<K>): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>] {
    if (this.isType()) {
      return [this as TypeOf<K>];
    }

    if (other.isType()) {
      return [other];
    }

    return I.is(this.value, other.value)
      ? [this as TypeOf<K>]
      : [this as TypeOf<K>, other];
  }

  _and(other: TypeOf<K>): [] | [TypeOf<K>] {
    if (this.isType()) {
      return [other];
    }

    if (other.isType()) {
      return [this as TypeOf<K>];
    }

    return I.is(this.value, other.value) ? [this as TypeOf<K>] : [];
  }

  protected literalEquals(
    other: TypeOf<K>,
    fn: (
      a: Exclude<ValueOf<K>, AnyType>,
      b: Exclude<ValueOf<K>, AnyType>
    ) => boolean
  ): boolean {
    if (this.value instanceof AnyType && other.value instanceof AnyType) {
      return true;
    }

    if (this.value instanceof AnyType || other.value instanceof AnyType) {
      return false;
    }

    return fn(this.value as any, other.value as any);
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
    return this.value instanceof AnyType;
  }
}

class NullType extends SimpleBase<"null"> {
  constructor() {
    super("null", null);
  }

  _equals(_other: NullType): boolean {
    return true;
  }

  isValue(): boolean {
    return true;
  }

  isType(): boolean {
    return true;
  }
}

class NumberType extends SimpleBase<"number"> {
  constructor(value?: ValueOf<"number">) {
    super("number", value);
  }

  literal(value: number): NumberType {
    return new NumberType(value);
  }

  _equals(other: NumberType): boolean {
    return this.literalEquals(other, (a, b) => a === b);
  }
}

class StringType extends SimpleBase<"string"> {
  constructor(value?: ValueOf<"string">) {
    super("string", value);
  }

  literal(value: string): StringType {
    return new StringType(value);
  }

  _equals(other: StringType): boolean {
    return this.literalEquals(other, (a, b) => a === b);
  }
}

class BooleanType extends SimpleBase<"boolean"> {
  constructor(value?: ValueOf<"boolean">) {
    super("boolean", value);
  }

  literal(value: boolean): BooleanType {
    return new BooleanType(value);
  }

  _equals(other: BooleanType): boolean {
    return this.literalEquals(other, (a, b) => a === b);
  }
}

class DateType extends SimpleBase<"date"> {
  constructor(value?: ValueOf<"date">) {
    super("date", value);
  }

  literal(value: L.DateTime): DateType {
    return new DateType(value);
  }

  _equals(other: DateType): boolean {
    return this.literalEquals(other, (a, b) => a === b);
  }
}

class DurationType extends SimpleBase<"duration"> {
  constructor(value?: ValueOf<"duration">) {
    super("duration", value);
  }

  literal(value: L.Duration): DurationType {
    return new DurationType(value);
  }

  _equals(other: DurationType): boolean {
    return this.literalEquals(other, (a, b) => a.equals(b));
  }
}

class LinkType extends SimpleBase<"link"> {
  constructor(value?: ValueOf<"link">) {
    super("link", value);
  }

  literal(value: Link): LinkType {
    return new LinkType(value);
  }

  _equals(other: LinkType): boolean {
    return this.literalEquals(other, (a, b) => a.equals(b));
  }
}

class WidgetType extends SimpleBase<"widget"> {
  constructor(value?: ValueOf<"widget">) {
    super("widget", value);
  }

  literal(value: Widget): WidgetType {
    return new WidgetType(value);
  }

  _equals(other: WidgetType): boolean {
    return this.literalEquals(other, (a, b) => a.$widget === b.$widget);
  }
}

const $Null = new NullType();
const $Number = new NumberType();
const $String = new StringType();
const $Boolean = new BooleanType();
const $Date = new DateType();
const $Duration = new DurationType();
const $Link = new LinkType();
const $Widget = new WidgetType();

// union
class UnionType extends TypeBase<"union"> {
  private constructor(value: ValueOf<"union">) {
    super("union", value);
  }

  private static new(value: ValueOf<"union">, errMsg?: string): Type {
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

  private static shrink(union: TypeOf<"union">, errMsg?: string): Type {
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

  _or(other: TypeOf<"union">): [TypeOf<"union">] {
    return [
      new UnionType(
        this.value.mergeWith(
          (ls, rs) => ls.flatMap((l: any) => rs.flatMap((r) => l._or(r))),
          other.value
        )
      )
    ];
  }

  _and(other: TypeOf<"union">): [TypeOf<"union">] {
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

  _equals(other: UnionType): boolean {
    return this.value.equals(other.value);
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

  and(other: Type): Type {
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
              v.value instanceof AnyType ? [] : [(v.toJSON() as any).value]
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

  _or(other: TypeOf<K>): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>] {
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
      return [this as unknown as TypeOf<K>, other];
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
        return [this as unknown as TypeOf<K>];
      case Grew.Both:
        return [this as unknown as TypeOf<K>, other];
    }
  }

  _and(other: TypeOf<K>): [] | [TypeOf<K>] {
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

  _equals(other: TypeOf<K>): boolean {
    return this.value.equals(other.value);
  }

  protected abstract new(
    unmapped: Type,
    mapped: ValueOf<K>["mapped"]
  ): TypeOf<K>;

  protected abstract mappedAnd(
    lm: ValueOf<K>["mapped"],
    rm: ValueOf<K>["mapped"]
  ): ValueOf<K>["mapped"];

  protected abstract mappedOr(
    lm: ValueOf<K>["mapped"],
    rm: ValueOf<K>["mapped"]
  ): ValueOf<K>["mapped"];

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
class ObjectVal extends I.Record({
  mapped: I.Map<string, Type>(),
  unmapped: $Error as Type
}) {}

class ObjectType extends CompositeBase<"object"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toMap();
  protected litWrap: [string, string] = ["{ ", " }"];

  constructor(value: ValueOf<"object"> = new ObjectVal({ unmapped: $Any })) {
    super("object", value);
  }

  protected new(unmapped: Type, mapped: I.Map<any, Type>): ObjectType {
    return new ObjectType(new ObjectVal({ unmapped, mapped }));
  }

  protected mappedOr(
    lm: ValueOf<"object">["mapped"],
    rm: ValueOf<"object">["mapped"]
  ): ValueOf<"object">["mapped"] {
    return lm.mergeWith((l, r) => l.or(r), rm);
  }

  protected mappedAnd(
    lm: ValueOf<"object">["mapped"],
    rm: ValueOf<"object">["mapped"]
  ): ValueOf<"object">["mapped"] {
    return I.Map(
      I.Set.union<string>([lm.keys(), rm.keys()]).flatMap((key) => {
        const val = lm.get(key, $Any).and(rm.get(key, $Any));
        return val.type === "error" ? [] : [[key, val]];
      })
    );
  }

  object(value: Record<string, Type>): Type {
    return new ObjectType(new ObjectVal({ mapped: I.Map(value) }));
  }

  objectOf(value: Type): Type {
    return new ObjectType(new ObjectVal({ unmapped: value }));
  }
}

const $Object = new ObjectType();

// array
class ArrayVal extends I.Record({
  mapped: I.List<Type>(),
  unmapped: $Error as Type
}) {}

class ArrayType extends CompositeBase<"array"> {
  protected toLit = () => this.value.mapped.map((v) => v.toJSON()).toArray();
  protected litWrap: [string, string] = ["[", "]"];

  constructor(value: ValueOf<"array"> = new ArrayVal({ unmapped: $Any })) {
    super("array", value);
  }

  protected new(unmapped: Type, mapped: I.List<Type>): ArrayType {
    return new ArrayType(new ArrayVal({ unmapped, mapped }));
  }

  protected mappedOr(
    lm: ValueOf<"array">["mapped"],
    rm: ValueOf<"array">["mapped"]
  ): ValueOf<"array">["mapped"] {
    return lm
      .zipAll(rm)
      .map(([l, r]) => (l || $Error).or((r || $Error) as Type));
  }

  protected mappedAnd(
    lm: ValueOf<"array">["mapped"],
    rm: ValueOf<"array">["mapped"]
  ): ValueOf<"array">["mapped"] {
    return I.Range(0, Math.max(lm.size, rm.size))
      .flatMap((key) => {
        const val = lm.get(key, $Any).and(rm.get(key, $Any));
        return val.type === "error" ? [] : [val];
      })
      .toList();
  }

  list(value: Type[]): Type {
    return new ArrayType(new ArrayVal({ mapped: I.List(value) }));
  }

  listOf(value: Type): Type {
    return new ArrayType(new ArrayVal({ unmapped: value }));
  }
}

const $Array = new ArrayType();

// function
class FunctionVal extends I.Record({
  args: I.List<Type>(),
  return: $Error as Type
}) {}

class FunctionType extends TypeBase<"function"> {
  constructor(value: FunctionVal = new FunctionVal()) {
    super("function", value);
  }

  or(_other: Type): Type {
    throw new Error("Method not implemented.");
  }
  and(_other: Type): Type {
    throw new Error("Method not implemented.");
  }
  _or(_other: TypeOf<"function">): TypeOf<"function">[] {
    throw new Error("Method not implemented.");
  }
  _and(_other: TypeOf<"function">): TypeOf<"function">[] {
    throw new Error("Method not implemented.");
  }
  _equals(_other: FunctionType): boolean {
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

// utility
function literal(
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
    return $Array.list(arg);
  }

  return $Object.object(arg);
}

// exports
export {
  $Null as Null,
  $Number as Number,
  $String as String,
  $Boolean as Boolean,
  $Date as Date,
  $Duration as Duration,
  $Link as Link,
  $Widget as Widget,
  $Error as Error,
  $Any as Any,
  $Object as Object,
  $Array as Array,
  $Function as Function,
  literal as $
};
