import * as I from "immutable";
import * as L from "luxon";
import { Link, Widget, Widgets } from "obsidian-dataview";

declare module "obsidian-dataview" {
  const Widgets: typeof import("obsidian-dataview/lib/data-model/value").Widgets;
}

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
  never: { type: NeverType; value: I.Set<NeverVal> };
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

export const enum Cmp {
  Equal = 0b00,
  Subset = 0b01,
  Superset = 0b10,
  Disjoint = 0b11
}

abstract class TypeBase<K extends TypeKey> implements I.ValueObject {
  constructor(public type: K, public value: ValueOf<K>) {}

  equals(other: unknown): boolean {
    return (
      other instanceof TypeBase && this.cmp(other as TypeOf<K>) === Cmp.Equal
    );
  }

  hashCode(): number {
    return 0x42108460 ^ I.hash(this.type) ^ I.hash(this.value);
  }

  isValue(): boolean {
    return !this.isType();
  }

  abstract or(other: Type): Type;
  abstract and(other: Type): Type;
  abstract cmp(other: Type): Cmp;
  abstract toString(): string;
  abstract toJSON(): unknown;
  abstract isType(): boolean;
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

  cmp(other: Type): Cmp {
    return other instanceof AnyType ? Cmp.Equal : Cmp.Superset;
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

// never
class NeverVal extends I.Record({
  message: "",
  vars: I.Set<string>()
}) {}

class NeverType extends TypeBase<"never"> {
  constructor(value: ValueOf<"never"> = I.Set()) {
    super("never", value);
  }

  error(message: string, vars: string[] = []): NeverType {
    return message === undefined
      ? $Never
      : new NeverType(
          this.value.add(new NeverVal({ message, vars: I.Set(vars) }))
        );
  }

  andError(a: Type, b: Type): NeverType {
    return $Never.error(`Can't combine '${a}' and '${b}'.`);
  }

  or(other: Type): Type {
    return other instanceof NeverType
      ? new NeverType(this.value.union(other.value))
      : other;
  }

  and(other: Type): Type {
    return other instanceof NeverType
      ? new NeverType(this.value.intersect(other.value))
      : this;
  }

  cmp(other: Type): Cmp {
    return other instanceof NeverType
      ? this.value.equals(other.value)
        ? Cmp.Equal
        : Cmp.Disjoint
      : Cmp.Subset;
  }

  toString(): string {
    if (this.value.size === 0) {
      return "never";
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
      type: "never",
      value: this.value
        .toArray()
        .map((v) => ({ message: v.message, vars: v.vars.toArray() }))
    };
  }

  isType(): true {
    return true;
  }
}

const $Never = new NeverType();

abstract class ValueBase<K extends ValueKey> extends TypeBase<K> {
  constructor(type: K, value: ValueOf<K>) {
    super(type, value);
  }

  or(other: Type): Type {
    return other instanceof AnyType
      ? other
      : other instanceof NeverType
      ? (this as unknown as TypeOf<K>)
      : UnionType.or(this as unknown as TypeOf<K>, other);
  }

  and(other: Type): Type {
    return other instanceof AnyType
      ? (this as unknown as TypeOf<K>)
      : other instanceof NeverType
      ? other
      : UnionType.and(this as unknown as TypeOf<K>, other);
  }

  cmp(other: Type): Cmp {
    return other instanceof AnyType
      ? Cmp.Subset
      : other instanceof NeverType
      ? Cmp.Superset
      : UnionType.cmp(this as unknown as TypeOf<K>, other);
  }

  protected abstract _or(
    other: TypeOf<K>
  ): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>];
  protected abstract _and(other: TypeOf<K>): [] | [TypeOf<K>];
  protected abstract _cmp(other: TypeOf<K>): Cmp;
}

abstract class UnitBase<K extends SimpleKey> extends ValueBase<K> {
  constructor(type: K, value?: ValueOf<K>) {
    super(type, value === undefined ? $Any : value);
  }

  _or(other: TypeOf<K>): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>] {
    const cmp = this.cmp(other);

    return cmp === Cmp.Disjoint
      ? [this as unknown as TypeOf<K>, other]
      : cmp === Cmp.Subset
      ? [other]
      : [this as unknown as TypeOf<K>];
  }

  _and(other: TypeOf<K>): [] | [TypeOf<K>] {
    const cmp = this.cmp(other);

    return cmp === Cmp.Disjoint
      ? []
      : cmp === Cmp.Subset
      ? [this as unknown as TypeOf<K>]
      : [other];
  }

  toString() {
    return this.isType() ? this.type : JSON.stringify(this.value);
  }

  toJSON() {
    return this.isValue()
      ? { type: this.type, value: this.value }
      : { type: this.type };
  }

  _cmp(other: TypeOf<K>): Cmp {
    const ltype = this.isType();
    const rtype = other.isType();

    return ltype && rtype
      ? Cmp.Equal
      : ltype
      ? Cmp.Superset
      : rtype
      ? Cmp.Subset
      : this._equals(this.value as any, other.value as any)
      ? Cmp.Equal
      : Cmp.Disjoint;
  }

  isType(): this is this & { value: AnyType } {
    return this.value instanceof AnyType;
  }

  isValue(): this is this & { value: Exclude<TypeOf<K>, AnyType> } {
    return !this.isType();
  }

  protected _equals(
    a: Exclude<ValueOf<K>, AnyType>,
    b: Exclude<ValueOf<K>, AnyType>
  ): boolean {
    return a === b;
  }
}

class NullType extends UnitBase<"null"> {
  constructor() {
    super("null", null);
  }

  protected override _equals(_a: null, _b: null): boolean {
    return true;
  }
}

class NumberType extends UnitBase<"number"> {
  constructor(value?: ValueOf<"number">) {
    super("number", value);
  }

  literal(value: number): NumberType {
    return new NumberType(value);
  }
}

class StringType extends UnitBase<"string"> {
  constructor(value?: ValueOf<"string">) {
    super("string", value);
  }

  literal(value: string): StringType {
    return new StringType(value);
  }
}

class BooleanType extends UnitBase<"boolean"> {
  constructor(value?: ValueOf<"boolean">) {
    super("boolean", value);
  }

  literal(value: boolean): BooleanType {
    return new BooleanType(value);
  }
}

class DateType extends UnitBase<"date"> {
  constructor(value?: ValueOf<"date">) {
    super("date", value);
  }

  literal(value: L.DateTime): DateType {
    return new DateType(value);
  }
}

class DurationType extends UnitBase<"duration"> {
  constructor(value?: ValueOf<"duration">) {
    super("duration", value);
  }

  literal(value: L.Duration): DurationType {
    return new DurationType(value);
  }

  protected override _equals(a: L.Duration, b: L.Duration): boolean {
    return a.equals(b);
  }
}

class LinkType extends UnitBase<"link"> {
  constructor(value?: ValueOf<"link">) {
    super("link", value);
  }

  literal(value: Link): LinkType {
    return new LinkType(value);
  }

  protected override _equals(a: Link, b: Link): boolean {
    return a.equals(b);
  }
}

class WidgetType extends UnitBase<"widget"> {
  constructor(value?: ValueOf<"widget">) {
    super("widget", value);
  }

  literal(value: Widget): WidgetType {
    return new WidgetType(value);
  }

  protected override _equals(a: Widget, b: Widget): boolean {
    return a.$widget === b.$widget;
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

  private static vals(val: ValueType | UnionType): ValueOf<"union"> {
    return val instanceof UnionType
      ? val.value
      : I.Map([[val.type, I.Set([val])]]);
  }

  private static shrink(vals: ValueOf<"union">, def: Type): Type {
    const size = vals.map((s) => s.size).reduce((l, r) => l + r, 0);

    switch (size) {
      case 0:
        return def;
      case 1:
        return vals.first<I.Set<ValueType>>().first<ValueType>();
      default:
        return new UnionType(vals);
    }
  }

  static or(ltype: ValueType | UnionType, rtype: ValueType | UnionType): Type {
    return UnionType.shrink(
      UnionType.vals(ltype).mergeWith(
        (
          ls: I.Set<NumberType /* ValueType */>,
          rs: I.Set<NumberType /* ValueType */>
        ) => ls.flatMap((l) => rs.flatMap((r) => l._or(r))),
        UnionType.vals(rtype)
      ),
      $Never
    );
  }

  static and(ltype: ValueType | UnionType, rtype: ValueType | UnionType): Type {
    const lvals = UnionType.vals(ltype);
    const rvals = UnionType.vals(rtype);

    return UnionType.shrink(
      I.Set.union<ValueKey>([lvals.keys(), rvals.keys()])
        .toMap()
        .flatMap((k) => {
          const res: I.Set<ValueType> = (
            lvals.get(k, I.Set()) as I.Set<NumberType /* ValueType */>
          ).flatMap((l) =>
            (
              rvals.get(k, I.Set()) as I.Set<NumberType /* ValueType */>
            ).flatMap((r) => l._and(r))
          );
          return res.isEmpty() ? [] : [[k, res]];
        }),
      $Never.andError(ltype, rtype)
    );
  }

  static cmp(ltype: ValueType | UnionType, rtype: ValueType | UnionType): Cmp {
    const lvals = UnionType.vals(ltype);
    const rvals = UnionType.vals(rtype);
    const keys = I.Set.intersect<ValueKey>([lvals.keys(), rvals.keys()]);

    let res =
      (keys.size < rvals.size ? Cmp.Subset : Cmp.Equal) |
      (keys.size < lvals.size ? Cmp.Superset : Cmp.Equal);

    if (res === Cmp.Disjoint) {
      return Cmp.Disjoint;
    }

    for (const key of keys) {
      const lval = lvals.get(key) as I.Set<NumberType /* ValueType */>;
      const rval = rvals.get(key) as I.Set<NumberType /* ValueType */>;

      for (const l of lval) {
        let curr = Cmp.Disjoint;

        for (const r of rval) {
          const next = l._cmp(r);

          if (next === Cmp.Disjoint) {
            continue;
          }

          if (curr === Cmp.Disjoint) {
            curr = next;
            continue;
          }

          curr |= next;

          if (curr === Cmp.Disjoint) {
            return Cmp.Disjoint;
          }
        }

        res |= curr;

        if (res === Cmp.Disjoint) {
          return Cmp.Disjoint;
        }
      }
    }

    return res;
  }

  or(other: Type): Type {
    return other instanceof AnyType
      ? other
      : other instanceof NeverType
      ? this
      : UnionType.or(this, other);
  }

  and(other: Type): Type {
    return other instanceof AnyType
      ? this
      : other instanceof NeverType
      ? other
      : UnionType.and(this, other);
  }

  cmp(other: Type): Cmp {
    return other instanceof AnyType
      ? Cmp.Subset
      : other instanceof NeverType
      ? Cmp.Superset
      : UnionType.cmp(this, other);
  }

  toString() {
    return this.value.map((t) => `${t}`).join(" or ");
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

type KeyOf<K extends CompositeKey> = K extends "object" ? string : number;
type KnownVal<K extends CompositeKey> = ValueOf<K>["known"];

abstract class CompositeBase<K extends CompositeKey> extends ValueBase<K> {
  constructor(type: K, value: ValueOf<K>) {
    super(type, value);
  }

  get(key: KeyOf<K>): Type {
    const _this = this as unknown as ObjectType; /* CompositeType */
    const _key = key as string; /* CompositeKey */

    return _this.value.known.get(_key, _this.value.unknown.or($Null));
  }

  protected _or(other: TypeOf<K>): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>] {
    const _this = this as unknown as ObjectType; /* CompositeType */
    const _other = other as unknown as ObjectType; /* CompositeType */

    const [cmp, canNormalize] = _this.cmpAndCheckNormalize(_other);

    const normalize = () =>
      this.new(
        this.value.unknown.or(other.value.unknown),
        this.mergeKnown(this.value.known, other.value.known)
      );

    return cmp === Cmp.Disjoint
      ? canNormalize
        ? [normalize()]
        : [_this, _other]
      : cmp === Cmp.Subset
      ? [_other]
      : [_this];
  }

  protected _and(other: TypeOf<K>): [] | [TypeOf<K>] {
    const _this = this as unknown as ObjectType; /* CompositeType */
    const _other = other as unknown as ObjectType; /* CompositeType */

    const isError = (a: Type, b: Type, res: Type): boolean =>
      res instanceof NeverType &&
      !(a instanceof NeverType || b instanceof NeverType);

    const unknown = _this.value.unknown.and(_other.value.unknown);

    if (isError(_this.value.unknown, _other.value.unknown, unknown)) {
      return [];
    }

    let known = this.emptyKnown().asMutable();

    for (const key of this.knownKeys(this.value.known, other.value.known)) {
      const _key = key as string; /* CompositeKey */

      const l = _this.get(_key);
      const r = _other.get(_key);
      const val = l.and(r);

      if (isError(l, r, val)) {
        return [];
      }

      this.appendKnown(known, key, val);
    }

    known = known.asImmutable();

    return [this.new(unknown, known)];
  }

  protected _cmp(other: TypeOf<K>): Cmp {
    return this.cmpAndCheckNormalize(other)[0];
  }

  protected cmpAndCheckNormalize(other: TypeOf<K>): [Cmp, boolean] {
    const _this = this as unknown as ObjectType; /* CompositeType */
    const _other = other as unknown as ObjectType; /* CompositeType */

    const knownSizes = (l: number): boolean =>
      this.value.known.size === l && other.value.known.size === l;

    let res = this.value.unknown.cmp(other.value.unknown);

    if (res === Cmp.Disjoint) {
      return [Cmp.Disjoint, knownSizes(0)];
    }

    const canNormalize = res === Cmp.Equal && knownSizes(1);

    for (const key of this.knownKeys(this.value.known, other.value.known)) {
      const _key = key as string; /* CompositeKey */

      res |= _this.get(_key).cmp(_other.get(_key));

      if (res === Cmp.Disjoint) {
        return [Cmp.Disjoint, canNormalize];
      }
    }

    return [res, false];
  }

  isType(): boolean {
    return (
      !(this.value.unknown.type === "never") ||
      this.value.known.some((t) => t.isType())
    );
  }

  protected mergeKnown(as: KnownVal<K>, bs: KnownVal<K>): KnownVal<K> {
    const _as = as as KnownVal<"object" /* CompositeKey */>;
    const _bs = bs as KnownVal<"object" /* CompositeKey */>;

    const res = this.emptyKnown().asMutable();

    for (const key of this.knownKeys(_as, _bs)) {
      const _key = key as string; /* KeyOf<K> */

      const a = _as.get(_key, $Never);
      const b = _bs.get(_key, $Never);

      this.appendKnown(res, key, a.or(b));
    }

    return res.asImmutable();
  }

  toJSON(): unknown {
    const known = this.value.known.isEmpty()
      ? {}
      : { known: this.knownToJSON() };

    const unknown =
      this.value.unknown instanceof NeverType
        ? {}
        : { unknown: this.value.unknown.toJSON() };

    return { type: this.type, value: { ...known, ...unknown } };
  }

  toString(): string {
    const { known, unknown } = this.value;

    return known.isEmpty()
      ? `${this.type}<${unknown}>`
      : `[${known.map((t, k) => this.toStringIndexed(k as any, t)).join(", ")}${
          unknown instanceof NeverType ? "" : `, ...${this.type}<${unknown}>`
        }]`;
  }

  protected abstract new(unknown: Type, known: KnownVal<K>): TypeOf<K>;
  protected abstract emptyKnown(): KnownVal<K>;
  protected abstract appendKnown(
    known: KnownVal<K>,
    key: KeyOf<K>,
    val: Type
  ): KnownVal<K>;
  protected abstract knownKeys(
    as: KnownVal<K>,
    bs: KnownVal<K>
  ): Iterable<KeyOf<K>>;
  protected abstract knownToJSON(): unknown;
  protected abstract literals: [string, string];
  protected abstract toStringIndexed(key: KeyOf<K>, type: Type): string;
}

// TODO: prevent compsite unknowns from containing parent type

// object
class ObjectVal extends I.Record({
  known: I.Map<string, Type>(),
  unknown: $Never as Type
}) {}

class ObjectType extends CompositeBase<"object"> {
  constructor(value: ValueOf<"object"> = new ObjectVal({ unknown: $Any })) {
    super("object", value);
  }

  protected new(unknown: Type, known: I.Map<any, Type>): ObjectType {
    return new ObjectType(new ObjectVal({ unknown, known }));
  }

  literal(value: Record<string, Type>): ObjectType {
    return this.new($Never, I.Map(value));
  }

  object(value: Record<string, Type>): ObjectType {
    return this.new($Any, I.Map(value));
  }

  objectOf(value: Type): ObjectType {
    return this.new(value, I.Map());
  }

  protected emptyKnown(): I.Map<string, Type> {
    return I.Map();
  }

  protected appendKnown(
    known: I.Map<string, Type>,
    key: string,
    val: Type
  ): I.Map<string, Type> {
    return known.set(key, val);
  }

  protected knownKeys(
    as: I.Map<string, Type>,
    bs: I.Map<string, Type>
  ): Iterable<string> {
    return I.Set.union([as.keys(), bs.keys()]);
  }

  protected knownToJSON(): unknown {
    return this.value.known.map((v) => v.toJSON()).toObject();
  }

  protected literals: [string, string] = ["{ ", " }"];

  protected toStringIndexed(key: string, type: Type): string {
    return `${key}: ${type}`;
  }
}

const $Object = new ObjectType();

// array
class ArrayVal extends I.Record({
  known: I.List<Type>(),
  unknown: $Never as Type
}) {}

class ArrayType extends CompositeBase<"array"> {
  constructor(value: ValueOf<"array"> = new ArrayVal({ unknown: $Any })) {
    super("array", value);
  }

  protected new(unknown: Type, known: I.List<Type>): ArrayType {
    return new ArrayType(new ArrayVal({ unknown, known }));
  }

  literal(value: Type[]): ArrayType {
    return this.new($Never, I.List(value));
  }

  list(value: Type[]): ArrayType {
    return this.new($Any, I.List(value));
  }

  listOf(value: Type): ArrayType {
    return this.new(value, I.List());
  }

  protected emptyKnown(): I.List<Type> {
    return I.List();
  }

  protected appendKnown(
    known: I.List<Type>,
    _key: number,
    val: Type
  ): I.List<Type> {
    return known.push(val);
  }

  protected knownKeys(as: I.List<Type>, bs: I.List<Type>): Iterable<number> {
    return as.size > bs.size ? as.keys() : bs.keys();
  }

  protected knownToJSON(): unknown {
    return this.value.known.map((v) => v.toJSON()).toArray();
  }

  protected literals: [string, string] = ["[", "]"];

  protected toStringIndexed(_key: number, type: Type): string {
    return `${type}`;
  }
}

const $Array = new ArrayType();

/*
FunctionType.define:
- Propagates errors
- Handles vectorization
- Splits on unions
- Provides utilities and context (?)
- Returns error if match not found
*/

const example = () => {
  const elink: FunctionType = $Function
    .define("elink", [0])
    .add([$String, $String], $Link, [0, 1], (a: string, d: string) =>
      $Widget.literal(Widgets.externalLink(a, d))
    )
    .add([$String, [$Null]], (s: StringType) => elink.eval(s, s))
    .add([$Null, [$Any]], () => $Null)
    .build();

  return elink;
};

// function
type Vararg = [Type];
type Optional = Type[] | [...Type[], Vararg];
type Required = Type[] | [...Type[], Optional];
type Fn = (...args: any[]) => Type;
type Valufy = number[];
type FunctionBuilderArgs = [Required, Fn] | [Required, Type, Valufy, Fn];

type FunctionBuilderVal = [ArrayType, (...args: Type[]) => Type][];

class FunctionBuilder {
  value: FunctionBuilderVal = [];

  constructor(public name = "<lambda>", public vectorize: number[] = []) {}

  add(...args: FunctionBuilderArgs): FunctionBuilder {
    const { required, optional, vararg } = this.splitArgs(args[0]);

    const fn =
      typeof args[1] === "function"
        ? args[1]
        : this.valufyFn(args[1], args[2] as Valufy, args[3] as Fn);

    const types = $Array.list(required);

    // TODO: handle vectorization
    // TODO: handle optionals
    // TODO: handle varargs

    this.value.push([types, fn]);

    return this;
  }

  build(): FunctionType {
    // TODO: build function

    throw "TODO";
  }

  private valufyFn(def: Type, valufy: Valufy, fn: Fn): Fn {
    return (...args: Type[]) => {
      for (const pos of valufy.filter((pos) => pos < args.length)) {
        const arg = args[pos];

        if (arg.isType()) {
          return def;
        }

        args[pos] = arg.value as any;
      }

      return fn(...args);
    };
  }

  private splitArgs(_required: Required): {
    required: Type[];
    optional: Type[];
    vararg: Type | null;
  } {
    let required: Type[];
    let optional: Type[];
    let vararg: Type | null;

    const _optional = _required.at(-1);

    if (_optional === undefined || _optional instanceof TypeBase) {
      // no optionals or vararg
      required = _required as Type[];
      optional = [];
      vararg = null;
    } else {
      // optionals, but maybe no vararg
      const _vararg = _optional.at(-1);

      if (_vararg === undefined || _vararg instanceof TypeBase) {
        // optionals, but no vararg
        required = _required.slice(0, -1) as Type[];
        optional = _optional as Type[];
        vararg = null;
      } else {
        // optionals and vararg
        required = _required.slice(0, -1) as Type[];
        optional = _optional.slice(0, -1) as Type[];
        vararg = _vararg[0];
      }
    }

    return { required, optional, vararg };
  }
}

class FunctionVal extends I.Record({
  args: I.List<ArrayType>(),
  fn: (() => $Never) as (...args: Type[]) => Type
}) {}

class FunctionType extends ValueBase<"function"> {
  constructor(
    value: FunctionVal = new FunctionVal({
      args: I.List([$Array.listOf($Any)]),
      fn: () => $Any
    })
  ) {
    super("function", value);
  }

  define(name: string, vectorize: number[] = []): FunctionBuilder {
    return new FunctionBuilder(name, vectorize);
  }

  eval(...args: Type[]): Type {
    return this.value.fn(...args);
  }

  protected _or(
    other: FunctionType
  ): [FunctionType] | [FunctionType, FunctionType] {
    return this.equals(other) ? [this] : [this, other];
  }

  protected _and(other: FunctionType): [] | [FunctionType] {
    return this.equals(other) ? [this] : [];
  }

  protected _cmp(other: FunctionType): Cmp {
    return this.equals(other) ? Cmp.Equal : Cmp.Disjoint;
  }

  toString(): string {
    return "TODO: FunctionType.toString()";
  }

  toJSON(): unknown {
    return "TODO: FunctionType.toJSON()";
  }

  isType(): boolean {
    return false;
  }
}

const $Function = new FunctionType();

// utility
function $(arg: null): NullType;
function $(arg: number): NumberType;
function $(arg: string): StringType;
function $(arg: boolean): BooleanType;
function $(arg: L.DateTime): DateType;
function $(arg: L.Duration): DurationType;
function $(arg: Link): LinkType;
function $(arg: Widget): WidgetType;
function $(arg: Record<string | number, Type>): ObjectType;
function $(arg: Type[]): ArrayType;
function $(
  arg:
    | null
    | number
    | string
    | boolean
    | L.DateTime
    | L.Duration
    | Link
    | Widget
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

  if (arg instanceof Link) {
    return $Link.literal(arg);
  }

  if (arg instanceof Widget) {
    return $Widget.literal(arg);
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
  $Never as Never,
  $Any as Any,
  $Object as Object,
  $Array as Array,
  $Function as Function,
  $ as $
};
