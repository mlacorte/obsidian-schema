import * as L from "luxon";

import { intersectIter, mergeObj, unionIter } from "./util";

// any
type AnyMap = TypeMap & {
  union: Union;
  never: NeverType;
};
type AnyKey = keyof AnyMap;

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

export interface IAny {
  kind: AnyKey;
  or(other: IAny): IAny;
  and(other: IAny): IAny;
}

export interface INever extends IAny {
  kind: "never";
  or<T extends IAny>(other: T): T;
  and(other: IAny): INever;
}

export interface IType<K extends TypeKey = TypeKey> extends IAny {
  kind: K;
  type: boolean;
  values: Set<TypeVal<K>>;
  or(other: INever): IType<K>;
  or(other: IType<K>): IType<K>;
  or(other: IAny): IUnion;
  and(other: INever): INever;
  and(other: IType<K>): IType<K> | INever;
  and(other: IType): INever;
  and(other: IUnion): IType<K> | INever;
}

export interface IUnion extends IAny {
  kind: "union";
  values: { [K in TypeKey]?: IType<K> };
  or(other: IAny): IUnion;
  and<T extends IAny>(other: T): T | INever;
}

type TypeVals<K extends TypeKey> = Set<TypeVal<K>>;

abstract class TypeBase<K extends TypeKey> implements IType<K> {
  abstract kind: K;
  type: boolean;

  protected _values: TypeVals<K>;

  get values() {
    if (this.type) {
      throw new Error("tried to access 'values' of a type");
    }

    return this._values;
  }

  constructor(values?: TypeVals<K>) {
    if (values) {
      this.type = false;
      this._values = values;
    } else {
      this.type = true;
    }
  }

  or(other: INever): IType<K>;
  or(other: IType<K>): IType<K>;
  or(other: IAny): IUnion;
  or(other: IAny): INever | IType<K> | IUnion {
    switch (other.kind) {
      case "never":
        return this;
      case this.kind:
        return this.grow(other as IType<K>);
      default:
        return Union.from(this).or(other);
    }
  }

  and(other: INever): INever;
  and(other: IType<K>): IType<K> | INever;
  and(other: IType): INever;
  and(other: IUnion): IType<K> | INever;
  and(other: IAny): IType<K> | INever {
    switch (other.kind) {
      case "never":
        return Never;
      case this.kind:
        return this.shrink(other as IType<K>);
      default:
        return (other as IUnion).and(this);
    }
  }

  protected abstract _or(other: IType<K>): IType<K>;
  protected abstract _and(other: IType<K>): IType<K>;

  private grow(other: IType<K>): IType<K> {
    return this.type ? this : other.type ? other : this._or(other);
  }

  private shrink(other: IType<K>): IType<K> | INever {
    const res = this._and(other);
    return !res.type && res.values.size === 0 ? Never : res;
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
};
type PrimKey = keyof PrimMap;

class PrimType<K extends PrimKey> extends TypeBase<K> {
  constructor(public kind: K, values?: TypeVals<K>) {
    super(values);
  }

  from(...vals: TypeVal<K>[]): PrimType<K> {
    return new PrimType(this.kind, new Set(vals));
  }

  protected _or(other: IType<K>): IType<K> {
    const l = this.values;
    const r = other.values;

    return new PrimType(this.kind, unionIter(l, r));
  }

  protected _and(other: IType<K>): IType<K> {
    const l = this.values;
    const r = other.values;

    return new PrimType(this.kind, intersectIter(l, r));
  }
}

export const Null = new PrimType("null");
export const Number = new PrimType("number");
export const String = new PrimType("string");
export const Boolean = new PrimType("boolean");
export const Date = new PrimType("date");
export const Duration = new PrimType("duration");

// union
type UnionVals = { [K in TypeKey]?: IType<K> };

class Union implements IUnion {
  kind = "union" as const;

  private constructor(public values: UnionVals) {}

  static from<T extends INever>(other: T): INever;
  static from<T extends IType | IUnion>(other: T): IUnion;
  static from<T extends IAny>(other: T): IUnion | INever {
    switch (other.kind) {
      case "never":
        return other as INever;
      case "union":
        return other as unknown as IUnion;
      default:
        return new Union({ [other.kind]: other });
    }
  }

  or(other: IAny): IUnion {
    if (other.kind === "never") {
      return this;
    }

    const that = Union.from(other as IType | IUnion);

    return new Union(
      mergeObj(this.values, that.values, (key) => {
        const l = this.values[key];
        const r = that.values[key];

        if (l && r) {
          return l.or(r);
        } else if (l) {
          return l;
        } else if (r) {
          return r;
        }
      })
    );
  }

  and<T extends IAny>(other: T): T | INever {
    if (other.kind === "never") {
      return other;
    }

    const that = Union.from(other as unknown as IType | IUnion);

    const res = mergeObj(this.values, that.values, (key) => {
      const l = this.values[key];
      const r = that.values[key];

      if (l && r) {
        return l.or(r);
      }
    });

    const vals = Object.values(res);

    switch (vals.length) {
      case 0:
        return Never;
      case 1:
        return vals[0] as unknown as T;
      default:
        return new Union(res) as unknown as T;
    }
  }
}

// never
class NeverType implements INever {
  kind = "never" as const;

  or<T extends IAny>(other: T): T {
    return other;
  }

  and(): INever {
    return this;
  }
}

export const Never = new NeverType();

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
