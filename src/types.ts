import * as L from "luxon";
import { Failure, Success } from "obsidian-dataview";
import { EXPRESSION, Result } from "obsidian-dataview";
import * as Parsimmon from "parsimmon";

type TypeMap = {
  null: { type: null; serialize: null; unlifted: null };
  number: { type: number; serialize: number; unlifted: number };
  string: { type: string; serialize: string; unlifted: string };
  boolean: { type: boolean; serialize: boolean; unlifted: boolean };
  date: { type: L.DateTime; serialize: string; unlifted: number };
  duration: { type: L.Duration; serialize: string; unlifted: number };
};

const ANY: unique symbol = Symbol("*");

type Types = keyof TypeMap;
type TypeOf<T extends Types> = TypeMap[T]["type"];
type Serialize<T extends Types> = TypeMap[T]["serialize"];
type Unlifted<T extends Types> = TypeMap[T]["unlifted"];

interface TypeFns<T extends Types> {
  serialize(val: TypeOf<T>): Serialize<T>;
  deserialize(val: any): Result<TypeOf<T>, string>;
  lift(val: Unlifted<T>): TypeOf<T>;
  unlift(val: TypeOf<T>): Unlifted<T>;
}

export class Union {
  private static readonly defaults = {
    null: null,
    number: null,
    string: null,
    boolean: null,
    date: null,
    duration: null
  };

  private static typeKeys = Object.keys(
    Union.defaults
  ) as (keyof typeof Union.defaults)[];

  public readonly type = "union";
  public readonly types: { [T in Types]: Type<T> | null };

  private constructor(values: { [T in Types]?: Type<T> } = {}) {
    this.types = { ...Union.defaults, ...values };
  }

  static literal<T extends Types>(key: T, value: TypeOf<T>): Union {
    const lit = {
      null: (val: null) => Null.literal(val),
      number: (val: number) => Number.literal(val),
      string: (val: string) => String.literal(val),
      boolean: (val: boolean) => Boolean.literal(val),
      date: (val: L.DateTime) => Date.literal(val),
      duration: (val: L.Duration) => Duration.literal(val)
    }[key] as (value: TypeOf<T>) => Type<T>;

    return new Union({ [key]: lit(value) });
  }

  static type<T extends Types>(key: T): Union {
    const type = {
      null: Null,
      number: Number,
      string: String,
      boolean: Boolean,
      date: Date,
      duration: Duration
    }[key] as Type<T>;

    return new Union({ [key]: type });
  }

  or(other: Union): Union {
    const values: any = {};

    this.iterate(other, (type, l, r) => {
      if (l && r) {
        values[type] = l.or(r);
      } else if (l) {
        values[type] = l;
      } else if (r) {
        values[type] = r;
      }
    });

    return new Union(values);
  }

  and(other: Union): Union {
    const values: any = {};

    this.iterate(other, (type, l, r) => {
      if (l && r) {
        const res = l.and(r);

        if (res.size !== 0) {
          values[type] = res;
        }
      }
    });

    return new Union(values);
  }

  // iterates over types
  *keys() {
    for (const [key, value] of this.entries()) {
      if (value === ANY) {
        yield key;
      }
    }
  }

  // iterates over literals
  *values() {
    for (const [_, value] of this.entries()) {
      if (value !== ANY) {
        yield value;
      }
    }
  }

  // iterates over types and literals
  *entries() {
    for (const key of Union.typeKeys) {
      const type = this.types[key];

      if (!type) {
        continue;
      }

      for (const value of type.values()) {
        yield [key, value] as {
          [K in keyof TypeMap]: [K, typeof ANY | TypeOf<K>];
        }[keyof TypeMap];
      }
    }
  }

  forEach(
    fn: <T extends Types>(
      value: typeof ANY | TypeOf<T>,
      key: T,
      union: Union
    ) => void
  ) {
    for (const [key, value] of this.entries()) {
      fn(value, key, this);
    }
  }

  get size() {
    let res = 0;

    for (const type of Union.typeKeys) {
      const val = this.types[type];

      if (val) {
        res += Math.abs(val.size);
      }
    }

    return res;
  }

  private iterate(
    other: Union,
    fn: <T extends Types>(type: T, l: Type<T> | null, r: Type<T> | null) => void
  ) {
    for (const type of Union.typeKeys) {
      fn(type, this.types[type], other.types[type]);
    }
  }
}

export class Type<T extends Types> implements TypeFns<T> {
  static declare<T extends Types>(type: T, fns: TypeFns<T>): Type<T> {
    return new Type<T>(type, ANY, fns);
  }

  readonly serialize = this.fns.serialize;
  readonly deserialize = this.fns.deserialize;
  readonly lift = this.fns.lift;
  readonly unlift = this.fns.unlift;

  private constructor(
    public readonly type: T,
    public readonly literals: typeof ANY | ReadonlyMap<Unlifted<T>, TypeOf<T>>,
    private readonly fns: TypeFns<T>
  ) {}

  literal(val: TypeOf<T>): Type<T> {
    if (this === undefined) {
      throw new Error("wtf?");
    }

    return this.clone([val]);
  }

  or(other: Type<T>): Type<T> {
    const lVals = this.literals;
    const rVals = other.literals;

    if (lVals === ANY || rVals === ANY) {
      return this.clone(ANY);
    }

    return this.clone([...lVals.keys(), ...rVals.keys()]);
  }

  and(other: Type<T>): Type<T> {
    const lVals = this.literals;
    const rVals = other.literals;

    if (lVals === ANY) {
      return this.clone(rVals);
    }

    if (rVals === ANY) {
      return this.clone(lVals);
    }

    return this.clone([...lVals.keys()].filter((lVal) => rVals.has(lVal)));
  }

  keys() {
    return this.values();
  }

  *values() {
    if (this.literals === ANY) {
      yield ANY;
    } else {
      for (const value of this.literals.values()) {
        yield value;
      }
    }
  }

  *entries() {
    for (const value of this.values()) {
      yield [value, value] as const;
    }
  }

  forEach(
    fn: (
      value: typeof ANY | TypeOf<T>,
      key: typeof ANY | TypeOf<T>,
      types: Type<T>
    ) => void
  ) {
    for (const value of this.values()) {
      fn(value, value, this);
    }
  }

  get size() {
    return this.literals === ANY ? -1 : this.literals.size;
  }

  private clone(
    values: typeof ANY | TypeOf<T>[] | ReadonlyMap<Unlifted<T>, TypeOf<T>>
  ) {
    return new Type<T>(
      this.type,
      values === ANY
        ? values
        : Array.isArray(values)
        ? new Map(values.map((v) => [this.unlift(v), v]))
        : new Map(values),
      this.fns
    );
  }
}

export const Null = Type.declare("null", {
  serialize: (val) => val,
  deserialize: (val) =>
    val === null || val === undefined
      ? new Success(null)
      : new Failure(`"${val}" not of type "null"`),
  lift: (val) => val,
  unlift: (val) => val
});

export const Number = Type.declare("number", {
  serialize: (val) => val,
  deserialize: (val) =>
    typeof val === "number"
      ? new Success(val)
      : new Failure(`"${val}" not of type "number"`),
  lift: (val) => val,
  unlift: (val) => val
});

export const String = Type.declare("string", {
  serialize: (val) => val,
  deserialize: (val) =>
    typeof val === "string"
      ? new Success(val)
      : new Failure(`"${val}" not of type "string"`),
  lift: (val) => val,
  unlift: (val) => val
});

export const Boolean = Type.declare("boolean", {
  serialize: (val) => val,
  deserialize: (val) =>
    typeof val === "boolean"
      ? new Success(val)
      : new Failure(`"${val}" not of type "boolean"`),
  lift: (val) => val,
  unlift: (val) => val
});

export const Date = Type.declare("date", {
  serialize: (val) => val.toISO(),
  deserialize: (val) => {
    const res = EXPRESSION.date.parse(val);
    return res.status
      ? new Success(res.value)
      : new Failure(Parsimmon.formatError(val, res));
  },
  lift: (val) => L.DateTime.fromMillis(val),
  unlift: (val) => val.toMillis()
});

export const Duration = Type.declare("duration", {
  serialize: (val) => val.toHuman(),
  deserialize: (val) => {
    const res = EXPRESSION.duration.parse(val);
    return res.status
      ? new Success(res.value)
      : new Failure(Parsimmon.formatError(val, res));
  },
  lift: (val) => L.Duration.fromMillis(val),
  unlift: (val) => val.toMillis()
});
