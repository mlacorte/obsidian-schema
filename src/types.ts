import {
  DateTime,
  Duration as _Duration,
  Failure,
  Success
} from "obsidian-dataview";
import { EXPRESSION, Result } from "obsidian-dataview";
import * as Parsimmon from "parsimmon";

type TypeMap = {
  null: { type: null; serialize: null; valueOf: null };
  number: { type: number; serialize: number; valueOf: number };
  string: { type: string; serialize: string; valueOf: string };
  boolean: { type: boolean; serialize: boolean; valueOf: boolean };
  date: { type: DateTime; serialize: string; valueOf: number };
  duration: { type: _Duration; serialize: string; valueOf: number };
};

type Types = keyof TypeMap;
type TypeOf<T extends Types> = TypeMap[T]["type"];
type SerializeTypeOf<T extends Types> = TypeMap[T]["serialize"];
type ValueTypeOf<T extends Types> = TypeMap[T]["valueOf"];

interface TypeFns<T extends Types> {
  serialize(val: TypeOf<T>): SerializeTypeOf<T>;
  deserialize(val: any): Result<TypeOf<T>, string>;
  valueOfFn(val: TypeOf<T>): ValueTypeOf<T>;
}

class Type<T extends Types> {
  static declare<T extends Types>(type: T, fns: TypeFns<T>): Type<T> {
    return new Type<T>(
      type,
      "*",
      fns.serialize,
      fns.deserialize,
      fns.valueOfFn
    );
  }

  private constructor(
    public readonly type: T,
    public readonly values: "*" | ReadonlySet<ValueTypeOf<T>>,
    public readonly serialize: (val: TypeOf<T>) => SerializeTypeOf<T>,
    public readonly deserialize: (val: any) => Result<TypeOf<T>, string>,
    public readonly valueOfFn: (val: TypeOf<T>) => ValueTypeOf<T>
  ) {}

  literal(val: TypeOf<T>): Type<T> {
    return this.clone([val]);
  }

  union(other: Type<T>): Type<T> {
    const lVals = this.values;
    const rVals = other.values;

    if (lVals === "*" || rVals === "*") {
      return this.clone("*");
    }

    return this.clone([...lVals, ...rVals]);
  }

  intersect(other: Type<T>): Type<T> {
    const lVals = this.values;
    const rVals = other.values;

    if (lVals === "*") {
      return this.clone(rVals);
    }

    if (rVals === "*") {
      return this.clone(lVals);
    }

    return this.clone([...lVals].filter((lVal) => rVals.has(lVal)));
  }

  get size() {
    return this.values === "*" ? -1 : this.values.size;
  }

  private clone(values: "*" | TypeOf<T>[] | ReadonlySet<ValueTypeOf<T>>) {
    return new Type<T>(
      this.type,
      values === "*"
        ? values
        : Array.isArray(values)
        ? new Set(values.map((v) => this.valueOfFn(v)))
        : new Set(values),
      this.serialize,
      this.deserialize,
      this.valueOfFn
    );
  }
}

export const Null = Type.declare("null", {
  serialize: (val) => val,
  deserialize: (val) =>
    val === null
      ? new Success(val)
      : new Failure(`"${val}" not of type "null"`),
  valueOfFn: (val) => val
});

export const Number = Type.declare("number", {
  serialize: (val) => val,
  deserialize: (val) =>
    typeof val === "number"
      ? new Success(val)
      : new Failure(`"${val}" not of type "number"`),
  valueOfFn: (val) => val
});

export const String = Type.declare("string", {
  serialize: (val) => val,
  deserialize: (val) =>
    typeof val === "string"
      ? new Success(val)
      : new Failure(`"${val}" not of type "string"`),
  valueOfFn: (val) => val
});

export const Boolean = Type.declare("boolean", {
  serialize: (val) => val,
  deserialize: (val) =>
    typeof val === "boolean"
      ? new Success(val)
      : new Failure(`"${val}" not of type "boolean"`),
  valueOfFn: (val) => val
});

export const Date = Type.declare("date", {
  serialize: (val) => val.toISO(),
  deserialize: (val) => {
    const res = EXPRESSION.date.parse(val);
    return res.status
      ? new Success(res.value)
      : new Failure(Parsimmon.formatError(val, res));
  },
  valueOfFn: (val) => val.valueOf()
});

export const Duration = Type.declare("duration", {
  serialize: (val) => val.toHuman(),
  deserialize: (val) => {
    const res = EXPRESSION.duration.parse(val);
    return res.status
      ? new Success(res.value)
      : new Failure(Parsimmon.formatError(val, res));
  },
  valueOfFn: (val) => val.valueOf()
});
