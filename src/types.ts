import { Set } from "immutable";
import * as L from "luxon";

// any
const any: unique symbol = Symbol("*");
type Any = typeof any;

type AnyMap = TypeMap & { union: UnionType };
type AnyKey = keyof AnyMap;

interface IType<K extends AnyKey> {
  key: K;
  or(other: IType<K>): IType<K>;
  and(other: IType<K>): IType<K>;
  isEmpty: boolean;
  isValue: boolean;
  isType: boolean;
  lift(): UnionType;
}

// type
type TypeMap = PrimMap & {
  object: ObjectType;
  array: ArrayType;
  tuple: TupleType;
  link: LinkType;
  function: FunctionType;
};
type TypeKey = keyof TypeMap;
type TypeVal<K extends TypeKey> = TypeMap[K];

// prim
type PrimMap = {
  null: null;
  number: number;
  string: string;
  boolean: boolean;
  date: L.DateTime;
  duration: L.Duration;
};

class PrimType<K extends TypeKey> implements IType<K> {
  constructor(public key: K, public state: Any | Set<TypeVal<K>>) {}

  literals(...vals: TypeVal<K>[]): PrimType<K> {
    return new PrimType(this.key, Set(vals));
  }

  or(other: PrimType<K>): PrimType<K> {
    if (this.state === any || other.state === any) {
      return this;
    }

    return new PrimType(this.key, this.state.union(other.state));
  }

  and(other: PrimType<K>): PrimType<K> {
    if (this.state === any) {
      return other;
    }

    if (other.state === any) {
      return this;
    }

    return new PrimType(this.key, this.state.intersect(other.state));
  }

  get isEmpty(): boolean {
    return this.state !== any && this.state.size === 0;
  }

  get isValue(): boolean {
    return this.state !== any && this.state.size === 1;
  }

  get isType(): boolean {
    return this.state === any || this.state.size >= 2;
  }

  lift(): UnionType {
    return Union.or(this);
  }
}

export const Null = new PrimType("null", any);
export const Number = new PrimType("number", any);
export const String = new PrimType("string", any);
export const Boolean = new PrimType("boolean", any);
export const Date = new PrimType("date", any);
export const Duration = new PrimType("duration", any);

// union
class UnionType implements IType<"union"> {
  key = "union" as const;

  constructor(public state: { [K in TypeKey]?: IType<K> } = {}) {}

  or(...types: IType<AnyKey>[]): UnionType {
    const state = { ...this.state };

    for (const type of this.flatten(types)) {
      const old = state[type.key] as any;

      this.update(state, old ? old.or(type) : type);
    }

    return new UnionType(state);
  }

  and(...types: IType<AnyKey>[]): UnionType {
    let state = { ...this.state };

    for (const union of types.map((t) => t.lift())) {
      const newState = {};

      for (const key of Object.keys(union) as TypeKey[]) {
        const old = state[key];
        const current = union.state[key];

        if (old && current) {
          this.update(newState, old.and(current as any));
        }
      }

      state = newState;
    }

    return new UnionType(state);
  }

  get isEmpty(): boolean {
    return Object.values(this.state).length === 0;
  }

  get isValue(): boolean {
    const vals = Object.values(this.state);

    return vals.length === 1 && vals[0].isValue;
  }

  get isType(): boolean {
    return !this.isEmpty && !this.isValue;
  }

  lift(): UnionType {
    return this;
  }

  private flatten(types: IType<AnyKey>[]): IType<TypeKey>[] {
    return types.flatMap((type) =>
      type.key === "union"
        ? Object.values((type as UnionType).state)
        : (type as IType<TypeKey>)
    );
  }

  private update<K extends TypeKey>(
    state: { [K in TypeKey]?: IType<K> },
    type: IType<K>
  ) {
    if (type.isEmpty) {
      delete state[type.key];
    } else {
      state[type.key] = type as any;
    }
  }
}

export const Union = new UnionType();

// object
class ObjectType {} // map<string, type>

// array
class ArrayType {} // array<type>

// tuple
class TupleType {} // array<type>

// link
class LinkType {} // { embed: boolean, path: string, subpath?: string, display?: string }

// function
class FunctionType {} // { args: tuple<any>, return: any }
