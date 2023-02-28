import * as I from "immutable";

type Id = string;
type Value = number;

type ValuePair = I.RecordOf<{ val: Value; conds: I.Set<ValueCond> }>;
type ValueCond = I.RecordOf<{ ref: ValueSet; val: Value }>;

const ValuePair = <T extends { val: Value; conds: I.Set<ValueCond> }>(arg: T) =>
  I.Record(arg)() as unknown as ValuePair;

const ValueCond = <T extends { ref: ValueSet; val: Value }>(arg: T) =>
  I.Record(arg)() as unknown as ValueCond;

let id = 1;

class ValueSet implements I.ValueObject {
  private readonly _id: number;
  private readonly vals: I.Set<ValuePair>;

  get id(): Id {
    return `<${this._id}>`;
  }

  private constructor() {
    this._id = id++;
  }

  private static new(fn: (self: ValueSet) => I.Set<ValuePair>): ValueSet {
    const valSet = new ValueSet();
    (valSet.vals as I.Set<ValuePair>) = fn(valSet);
    return valSet;
  }

  static val(vals: Value[]): ValueSet {
    if (vals.length === 0) {
      throw new Error("'vals' must not be empty");
    }

    return ValueSet.new((ref) =>
      I.Set(
        vals.length === 1 // performance optimization
          ? [ValuePair({ val: vals[0], conds: I.Set() })]
          : vals.map((val) =>
              ValuePair({ val, conds: I.Set([ValueCond({ ref, val })]) })
            )
      )
    );
  }

  static fn<Args extends ValueSet[]>(
    args: [...Args],
    fn: (...vals: { [I in keyof Args]: Value }) => Value
  ): ValueSet {
    // performance optimization
    args = args.sort((a, b) => a.vals.size - b.vals.size);

    return ValueSet.new(() =>
      I.Set(
        args
          .reduce(
            (acc, arg) =>
              acc.flatMap(({ args, world, conds: lConds }) =>
                arg.vals.toArray().flatMap(({ val, conds: rConds }) =>
                  world.has(arg) && world.get(arg) !== val
                    ? []
                    : [
                        {
                          args: [...args, val],
                          world: world.set(arg, val),
                          conds: lConds
                            .union(rConds)
                            .filter(
                              (cond) => arg !== cond.ref || val === cond.val
                            )
                        }
                      ]
                )
              ),
            [
              {
                args: [] as Value[],
                world: I.Map<ValueSet, Value>(),
                conds: I.Set<ValueCond>()
              }
            ]
          )
          .map(({ args, conds }) => {
            const val = fn(...(args as any));
            return ValuePair({ val, conds });
          })
      )
    );
  }

  toJS(): {
    id: Id;
    vals: Array<{ val: Value; conds: Array<[Id, Value]> }>;
  } {
    return {
      id: this.id,
      vals: this.vals
        .toArray()
        .sort((l, r) => l.val - r.val)
        .map((p) => ({
          val: p.val,
          conds: p.conds
            .toArray()
            .sort((l, r) =>
              l.ref === r.ref ? l.val - r.val : l.ref._id - r.ref._id
            )
            .map((c) => [c.ref.id, c.val])
        }))
    };
  }

  values(): Value[] {
    return this.toJS().vals.map((p) => p.val);
  }

  conditions(): [Id, Value][][] {
    return this.toJS().vals.map((p) => p.conds);
  }

  equals(other: unknown): boolean {
    return this === other;
  }

  hashCode(): number {
    return 0x42108426 ^ this.vals.hashCode();
  }
}

export const fn = ValueSet.fn;
export const val = ValueSet.val;
