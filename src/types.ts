import * as I from "immutable";
import * as L from "luxon";
import { Link, Widget, Widgets } from "obsidian-dataview";

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
  Equal = 0b00, // 0
  Subset = 0b01, // 1
  Superset = 0b10, // 2
  Disjoint = 0b11 // 3
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
  abstract types(): I.Seq.Indexed<Type>;
}

// any
class AnyType extends TypeBase<"any"> {
  constructor() {
    super("any", "*");
  }

  or(_other: Type): Type {
    return TAny;
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

  types(): I.Seq.Indexed<Type> {
    return I.Seq([this]);
  }
}

const TAny = new AnyType();

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
      ? TNever
      : new NeverType(
          this.value.add(new NeverVal({ message, vars: I.Set(vars) }))
        );
  }

  andError(a: Type, b: Type): NeverType {
    return TNever.error(`Can't combine '${a}' and '${b}'.`);
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

  types(): I.Seq.Indexed<Type> {
    return I.Seq([this]);
  }
}

const TNever = new NeverType();

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

  types(): I.Seq.Indexed<Type> {
    return I.Seq([this as unknown as TypeOf<K>]);
  }

  protected abstract _or(
    other: TypeOf<K>
  ): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>];
  protected abstract _and(other: TypeOf<K>): [] | [TypeOf<K>];
  protected abstract _cmp(other: TypeOf<K>): Cmp;
}

type IsType<T> = T extends NullType ? T : T & { value: AnyType };
type IsValue<T> = T extends NullType ? T : T & { value: Exclude<T, AnyType> };

abstract class UnitBase<K extends SimpleKey> extends ValueBase<K> {
  constructor(type: K, value?: ValueOf<K>) {
    super(type, value === undefined ? TAny : value);
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

  toJSON(): unknown {
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

  isType(): this is IsType<this> {
    return this.value instanceof AnyType;
  }

  isValue(): this is IsValue<this> {
    return !this.isType();
  }

  wrap(val: ValueOf<K> | TypeOf<K>): TypeOf<K> {
    return val instanceof UnitBase ? val : this.literal(val);
  }

  protected _equals(
    a: Exclude<ValueOf<K>, AnyType>,
    b: Exclude<ValueOf<K>, AnyType>
  ): boolean {
    return a === b;
  }

  abstract literal(val: ValueOf<K>): TypeOf<K>;
}

class NullType extends UnitBase<"null"> {
  constructor() {
    super("null", null);
  }

  literal(_val: null): NullType {
    return TNull;
  }

  protected override _equals(_a: null, _b: null): boolean {
    return true;
  }
}

class NumberType extends UnitBase<"number"> {
  constructor(value?: ValueOf<"number">) {
    super("number", value);
  }

  literal(value: number): IsValue<NumberType> {
    return new NumberType(value) as IsValue<NumberType>;
  }
}

class StringType extends UnitBase<"string"> {
  constructor(value?: ValueOf<"string">) {
    super("string", value);
  }

  literal(value: string): IsValue<StringType> {
    return new StringType(value) as IsValue<StringType>;
  }
}

class BooleanType extends UnitBase<"boolean"> {
  constructor(value?: ValueOf<"boolean">) {
    super("boolean", value);
  }

  literal(value: boolean): IsValue<BooleanType> {
    return new BooleanType(value) as IsValue<BooleanType>;
  }

  override _or(other: BooleanType): [BooleanType] {
    const cmp = this.cmp(other);

    return cmp === Cmp.Disjoint
      ? [TBoolean] // true | false = boolean
      : cmp === Cmp.Subset
      ? [other]
      : [this];
  }
}

class DateType extends UnitBase<"date"> {
  constructor(value?: ValueOf<"date">) {
    super("date", value);
  }

  literal(value: L.DateTime): IsValue<DateType> {
    return new DateType(value) as IsValue<DateType>;
  }
}

class DurationType extends UnitBase<"duration"> {
  constructor(value?: ValueOf<"duration">) {
    super("duration", value);
  }

  literal(value: L.Duration): IsValue<DurationType> {
    return new DurationType(value) as IsValue<DurationType>;
  }

  protected override _equals(a: L.Duration, b: L.Duration): boolean {
    return a.equals(b);
  }
}

class LinkType extends UnitBase<"link"> {
  constructor(value?: ValueOf<"link">) {
    super("link", value);
  }

  literal(value: Link): IsValue<LinkType> {
    return new LinkType(value) as IsValue<LinkType>;
  }

  protected override _equals(a: Link, b: Link): boolean {
    return a.equals(b);
  }
}

class WidgetType extends UnitBase<"widget"> {
  constructor(value?: ValueOf<"widget">) {
    super("widget", value);
  }

  literal(value: Widget): IsValue<WidgetType> {
    return new WidgetType(value) as IsValue<WidgetType>;
  }

  protected override _equals(a: Widget, b: Widget): boolean {
    return a.$widget === b.$widget;
  }
}

const TNull = new NullType();
const TNumber = new NumberType() as IsType<NumberType>;
const TString = new StringType() as IsType<StringType>;
const TBoolean = new BooleanType() as IsType<BooleanType>;
const TDate = new DateType() as IsType<DateType>;
const TDuration = new DurationType() as IsType<DurationType>;
const TLink = new LinkType() as IsType<LinkType>;
const TWidget = new WidgetType() as IsType<WidgetType>;

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
      TNever
    );
  }

  static and(ltype: ValueType | UnionType, rtype: ValueType | UnionType): Type {
    const lvals = UnionType.vals(ltype);
    const rvals = UnionType.vals(rtype);

    return UnionType.shrink(
      I.Set.union<ValueKey>([lvals.keySeq(), rvals.keySeq()])
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
      TNever.andError(ltype, rtype)
    );
  }

  static cmp(ltype: ValueType | UnionType, rtype: ValueType | UnionType): Cmp {
    const lvals = UnionType.vals(ltype);
    const rvals = UnionType.vals(rtype);
    const keys = I.Set.intersect<ValueKey>([lvals.keySeq(), rvals.keySeq()]);

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

  types(): I.Seq.Indexed<Type> {
    return this.value.valueSeq().flatMap((v) => v);
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
    return this.types()
      .map((t) => `${t}`)
      .join(" or ");
  }

  toJSON(): unknown {
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
type KeyType<K extends CompositeKey> = K extends "object"
  ? StringType
  : NumberType;
type KnownVal<K extends CompositeKey> = ValueOf<K>["known"];

abstract class CompositeBase<K extends CompositeKey> extends ValueBase<K> {
  private _allTypes: Type | null = null;

  constructor(type: K, value: ValueOf<K>) {
    super(type, value);
  }

  get(key: KeyOf<K> | KeyType<K>): Type {
    const _this = this as unknown as ObjectType; /* CompositeType */
    const _key = this.wrapKey(key) as StringType; /* KeyType<K> */

    return _key.isValue()
      ? _this.value.known.get(_key.value, _this.value.unknown.or(TNull))
      : this.allTypes;
  }

  protected get allTypes(): Type {
    if (this._allTypes === null) {
      this._allTypes = this.value.known
        .valueSeq()
        .reduce((a, b) => a.or(b), this.value.unknown.or(TNull));
    }

    return this._allTypes;
  }

  get size(): NumberType {
    return this.value.unknown instanceof NeverType
      ? TNumber.literal(this.value.known.size)
      : TNumber;
  }

  protected _or(other: TypeOf<K>): [TypeOf<K>] | [TypeOf<K>, TypeOf<K>] {
    const _this = this as unknown as ObjectType; /* CompositeType */
    const _other = other as unknown as ObjectType; /* CompositeType */

    const [cmp, canNormalize] = _this.cmpAndCheckNormalize(_other);

    const normalize = () =>
      this.new(
        this.mergeKnown(this.value.known, other.value.known),
        this.value.unknown.or(other.value.unknown)
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

    return [this.new(known, unknown)];
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

  isKnown(): this is Exclude<this, { value: { unknown: NeverType } }> {
    return this.value.unknown instanceof NeverType;
  }

  isType(): boolean {
    return !this.isKnown() || this.value.known.some((t) => t.isType());
  }

  protected mergeKnown(as: KnownVal<K>, bs: KnownVal<K>): KnownVal<K> {
    const _as = as as KnownVal<"object" /* CompositeKey */>;
    const _bs = bs as KnownVal<"object" /* CompositeKey */>;

    const res = this.emptyKnown().asMutable();

    for (const key of this.knownKeys(_as, _bs)) {
      const _key = key as string; /* KeyOf<K> */

      const a = _as.get(_key, TNever);
      const b = _bs.get(_key, TNever);

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
    const empty = this.literals.join("").replace(/ +/g, "");

    const emptyKnown = known.isEmpty();
    const emptyUnknown = unknown instanceof NeverType;

    return emptyKnown && emptyUnknown
      ? empty
      : emptyKnown
      ? `${this.unknownCtr}(${unknown})`
      : `${this.literals[0]}${known
          .map((t, k) => this.toStringIndexed(k as any, t))
          .join(", ")}${
          emptyUnknown ? "" : `, ...${this.unknownCtr}(${unknown})`
        }${this.literals[1]}`;
  }

  protected abstract wrapKey(key: KeyOf<K> | KeyType<K>): KeyType<K>;
  protected abstract new(known: KnownVal<K>, unknown: Type): TypeOf<K>;
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
  protected abstract unknownCtr: string;
}

// object
class ObjectVal extends I.Record({
  known: I.Map<string, Type>(),
  unknown: TNever as Type
}) {}

class ObjectType extends CompositeBase<"object"> {
  constructor(value: ValueOf<"object"> = new ObjectVal({ unknown: TAny })) {
    super("object", value);
  }

  new(known: I.Map<any, Type>, unknown: Type): ObjectType {
    return new ObjectType(new ObjectVal({ unknown, known }));
  }

  object(def: Type = TAny, value: Record<string, Type> = {}): ObjectType {
    return this.new(I.Map(value), def);
  }

  literal(value: Record<string, Type> = {}): ObjectType {
    return this.object(TNever, value);
  }

  protected wrapKey(key: string | StringType): StringType {
    return TString.wrap(key);
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
    return I.Set.union([as.keySeq(), bs.keySeq()]);
  }

  protected knownToJSON(): unknown {
    return this.value.known.map((v) => v.toJSON()).toObject();
  }

  protected literals: [string, string] = ["{ ", " }"];

  protected toStringIndexed(key: string, type: Type): string {
    return `${key}: ${type}`;
  }

  protected unknownCtr = "objectOf";
}

const TObject = new ObjectType();

// array
class ArrayVal extends I.Record({
  known: I.List<Type>(),
  unknown: TNever as Type
}) {}

class ArrayType extends CompositeBase<"array"> {
  constructor(value: ValueOf<"array"> = new ArrayVal({ unknown: TAny })) {
    super("array", value);
  }

  new(known: I.List<Type>, unknown: Type): ArrayType {
    return new ArrayType(new ArrayVal({ unknown, known }));
  }

  list(def: Type = TAny, value: Type[] = []): ArrayType {
    return this.new(I.List(value), def);
  }

  literal(value: Type[] = []): ArrayType {
    return this.list(TNever, value);
  }

  append(value: Type): ArrayType {
    return this.new(this.value.known.push(value), this.value.unknown);
  }

  protected wrapKey(key: number | NumberType): NumberType {
    return TNumber.wrap(key);
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
    return as.size > bs.size ? as.keySeq() : bs.keySeq();
  }

  protected knownToJSON(): unknown {
    return this.value.known.map((v) => v.toJSON()).toArray();
  }

  protected literals: [string, string] = ["[", "]"];

  protected toStringIndexed(_key: number, type: Type): string {
    return `${type}`;
  }

  protected unknownCtr = "listOf";
}

const TArray = new ArrayType();

// function
type Vararg = [Type];
type Optional = Type[] | [...Type[], Vararg];
type Required = Type[] | [...Type[], Optional];
type Fn<T> = (...args: T[]) => Type;
type Valufy = number[];
type FunctionBuilderArgs =
  | [Required, Fn<Type>]
  | [Required, Type, Valufy, Fn<any>];

type FunctionBuilderVal = [ArrayType, (...args: Type[]) => Type][];

class FunctionBuilder {
  value: FunctionBuilderVal = [];

  constructor(public name = "<lambda>", public vectorize: number[] = []) {}

  add(...args: FunctionBuilderArgs): FunctionBuilder {
    const { required, optional, vararg } = this.splitArgs(args[0]);
    const argList = [...required, ...optional];

    // vectorized types
    for (const pos of this.vectorize.filter((pos) => pos < argList.length)) {
      const arg = argList[pos];

      argList[pos] = arg.or(TArray.list(arg));
    }

    // optional types
    for (let pos = required.length; pos < argList.length; pos++) {
      const arg = argList[pos];

      argList[pos] = arg.or(TNull);
    }

    // vararg types
    const types = TArray.list(vararg || TNever, argList);

    // valufy function
    let fn =
      typeof args[1] === "function"
        ? args[1]
        : this.valufyFn(args[1], args[2] as Valufy, args[3] as Fn<any>);

    // vectorize function
    fn = this.vectorizeFn(fn);

    // add final result
    this.value.push([types, fn]);

    return this;
  }

  build(): FunctionType {
    const fn: Fn<Type> = (...args: Type[]): Type => {
      // propagate errors
      const errors = args.filter((arg) => arg instanceof NeverType);

      if (errors.length > 0) {
        return errors.reduce((res, err) => res.or(err), TNever);
      }

      // finds match
      const argList = TArray.literal(args);
      let matchFn: Fn<Type> | null = null;

      for (const [types, fn] of this.value) {
        if (argList.cmp(types) <= Cmp.Subset) {
          matchFn = fn;
          break;
        }
      }

      // throws error if none found
      if (matchFn === null) {
        return TNever.error(
          `No implementation of '${this.name}' found for arguments: ${args
            .map((a) => `${a}`)
            .join(", ")}`
        );
      }

      // split on unions
      const argCombos = args.reduce<Type[][]>(
        (res, arg) =>
          arg
            .types()
            .flatMap((t) => res.map((prev) => [...prev, t]))
            .toArray(),
        [[]]
      );

      // union all results
      return argCombos
        .map((argCombo) => (matchFn as Fn<Type>)(...argCombo))
        .reduce((a, b) => a.or(b), TNever);
    };

    const types = this.value
      .map((pair) => pair[0])
      .reduce((a, b) => a.or(b), TNever);

    return FunctionType.new(this.name, types, fn);
  }

  private valufyFn(def: Type, valufy: Valufy, fn: Fn<any>): Fn<Type> {
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

  private vectorizeFn(fn: Fn<Type>): Fn<Type> {
    return (...args: Type[]): Type => {
      const vecMap = new Map(
        this.vectorize
          .filter((pos) => args[pos] instanceof ArrayType && pos < args.length)
          .map((pos) => [pos, args[pos] as ArrayType])
      );

      const vecs = [...vecMap.values()];

      if (vecs.length === 0) {
        return fn(...args);
      }

      const maxOrInfinity = Math.min(
        ...vecs.map((t) => (t.isKnown() ? t.value.known.size : Infinity))
      );
      const min = Math.min(...vecs.map((t) => t.value.known.size));
      const max =
        maxOrInfinity !== Infinity
          ? maxOrInfinity
          : Math.max(...vecs.map((t) => t.value.known.size));

      let res = TArray.literal();
      const results: Type[] = min === 0 ? [res] : [];

      for (let subPos = 0; subPos < max; subPos++) {
        const subArgs = [...args];

        for (const [vecPos, vecArg] of vecMap.entries()) {
          subArgs[vecPos] = vecArg.get(subPos);
        }

        res = res.append(fn(...subArgs));

        if (subPos + 1 >= min) {
          results.push(res);
        }
      }

      if (maxOrInfinity === Infinity) {
        const lastPos = results.length - 1;
        const last = results[lastPos] as ArrayType;

        const subArgs = [...args];

        for (const [vecPos, vecArg] of vecMap.entries()) {
          subArgs[vecPos] = vecArg.value.known.get(max, vecArg.value.unknown);
        }

        results[lastPos] = TArray.new(last.value.known, fn(...subArgs));
      }

      return results.reduce((a, b) => a.or(b), TNever);
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

type FunctionVal = (...args: Type[]) => Type;

class FunctionType extends ValueBase<"function"> {
  constructor(
    public name: string = "<function>",
    public args: Type = TArray.list(),
    value: FunctionVal = () => TAny
  ) {
    super("function", value);
  }

  static new(
    name: string,
    args: Type,
    fn: (...args: Type[]) => Type
  ): FunctionType {
    return new FunctionType(name, args, fn);
  }

  define(name: string, vectorize: number[] = []): FunctionBuilder {
    return new FunctionBuilder(name, vectorize);
  }

  eval(...args: Type[]): Type {
    return this.value(...args);
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
    return `${this.name}(...${this.args})`;
  }

  toJSON(): unknown {
    return {
      type: "function",
      name: this.name,
      args: this.args.toString()
    };
  }

  isType(): boolean {
    return false;
  }
}

const TFunction = new FunctionType();

export const choice: FunctionType = TFunction.define("choice", [0, 1, 2])
  .add([TBoolean, TAny, TAny], (cond: BooleanType, pass: Type, fail: Type) =>
    cond.isType() ? pass.or(fail) : cond.value ? pass : fail
  )
  .build();

export const elink: FunctionType = TFunction.define("elink", [0])
  .add([TString, TString], TLink, [0, 1], (a: string, d: string) =>
    TWidget.literal(Widgets.externalLink(a, d))
  )
  .add([TString, [TNull]], (s: StringType) => elink.eval(s, s))
  .add([TNull, [TAny]], () => TNull)
  .build();

const TTrue = TBoolean.literal(true);
const TFalse = TBoolean.literal(false);

throw choice.toString();

// exports
export {
  TNull as Null,
  TNumber as Number,
  TString as String,
  TBoolean as Boolean,
  TDate as Date,
  TDuration as Duration,
  TLink as Link,
  TWidget as Widget,
  TNever as Never,
  TAny as Any,
  TObject as Object,
  TArray as Array,
  TFunction as Function,
  TTrue as True,
  TFalse as False
};

export type {
  NullType,
  NumberType,
  StringType,
  BooleanType,
  DateType,
  DurationType,
  LinkType,
  WidgetType,
  NeverType,
  AnyType,
  ObjectType,
  ArrayType,
  FunctionType
};
