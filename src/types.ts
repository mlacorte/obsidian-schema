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
type TypeVal<K extends TypeKey = TypeKey> = TypeMap[K];

export interface IAny {
  kind: AnyKey;
  type: boolean;
  types: Set<TypeKey>;
  values: Set<TypeVal>;
  or(other: IAny): IAny;
  and(other: IAny): IAny;
}

export interface INever extends IAny {
  kind: "never";
  type: true;
  types: Set<any>;
  values: Set<any>;
}

export interface IType<K extends TypeKey = TypeKey> extends IAny {
  kind: K;
  type: boolean;
  types: Set<K>;
  values: Set<TypeVal<K>>;
}

export interface IUnion extends IAny {
  kind: "union";
  type: true;
  subtypes: { [K in TypeKey]?: IType<K> };
}

abstract class TypeBase<K extends TypeKey> implements IType<K> {
  abstract kind: K;
  type: boolean;
  values: Set<TypeVal<K>>;

  get types(): Set<K> {
    return new Set([this.kind]);
  }

  constructor(values?: Set<TypeVal<K>>) {
    this.type = !values;
    this.values = values || new Set();
  }

  or(other: IAny): IAny {
    switch (other.kind) {
      case "never":
        return this;
      case "union":
        return other.or(this);
      case this.kind:
        return this.type
          ? this
          : other.type
          ? other
          : this._or(other as IType<K>);
      default:
        return Union.from(this).or(other);
    }
  }

  and(other: IAny): IAny {
    let res: IAny;

    switch (other.kind) {
      case "never":
        return Never;
      case "union":
        return other.and(this);
      case this.kind:
        res = this._and(other as IType<K>);
        if (res.type) {
          return res;
        } else {
          return res.values.size === 0 ? Never : res;
        }
      default:
        return Never;
    }
  }

  protected abstract _or(other: IType<K>): IType<K>;
  protected abstract _and(other: IType<K>): IType<K>;
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
  constructor(public kind: K, values?: Set<TypeVal<K>>) {
    super(values);
  }

  from(val: TypeVal<K>, ...vals: TypeVal<K>[]): PrimType<K> {
    return new PrimType(this.kind, new Set([val, ...vals]));
  }

  protected _or(other: IType<K>): IType<K> {
    return new PrimType(this.kind, unionIter(this.values, other.values));
  }

  protected _and(other: IType<K>): IType<K> {
    if (this.type) {
      return other;
    }

    if (other.type) {
      return this;
    }

    return new PrimType(this.kind, intersectIter(this.values, other.values));
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
  type = true as const;

  get values(): Set<TypeVal> {
    return new Set(
      Object.values(this.subtypes).flatMap((type) => [...type.values])
    );
  }

  get types(): Set<TypeKey> {
    return new Set(Object.keys(this.subtypes) as TypeKey[]);
  }

  private constructor(public subtypes: UnionVals) {}

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
      mergeObj(this.subtypes, that.subtypes, (key) => {
        const l = this.subtypes[key];
        const r = that.subtypes[key];

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

    const res = mergeObj(this.subtypes, that.subtypes, (key) => {
      const l = this.subtypes[key];
      const r = that.subtypes[key];

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
  type = true as const;
  types = new Set<any>();
  values = new Set<any>();

  or(other: IAny): IAny {
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
