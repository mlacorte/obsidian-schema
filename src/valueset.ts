import * as I from "immutable";

type Id = string;
type Value = number;

class PossibleValue extends I.Record({
  val: NaN as Value,
  conds: I.Map<Id, Value>()
}) {}

let $id = 1;

class ValueSet {
  private readonly _id: number;
  private readonly vals: I.Set<PossibleValue>;

  get id(): Id {
    return `<${this.name}:${this._id}>`;
  }

  private constructor(private readonly name: string) {
    this._id = $id++;
  }

  private static new(
    name: string,
    fn: (self: ValueSet) => I.Set<PossibleValue>
  ): ValueSet {
    const valSet = new ValueSet(name);
    (valSet.vals as I.Set<PossibleValue>) = fn(valSet);
    return valSet;
  }

  static val(name: string, vals: Value[]): ValueSet {
    if (vals.length === 0) {
      throw new Error("'vals' must not be empty");
    }

    return ValueSet.new(name, (ref) =>
      I.Set(
        vals.length === 1 // performance optimization
          ? [new PossibleValue({ val: vals[0], conds: I.Map() })]
          : vals.map(
              (val) => new PossibleValue({ val, conds: I.Map([[ref.id, val]]) })
            )
      )
    );
  }

  static fn<Args extends ValueSet[]>(
    name: string,
    args: [...Args],
    fn: (...vals: { [I in keyof Args]: Value }) => Value
  ): ValueSet {
    // performance optimization
    args = args.sort((a, b) => a.vals.size - b.vals.size);

    return ValueSet.new(name, () =>
      I.Set(
        args
          .reduce(
            (acc, { id, vals }) =>
              acc.flatMap(({ argVals, conds: oldConds }) =>
                vals.toArray().flatMap(({ val: newVal, conds: newConds }) => {
                  const conds = oldConds.asMutable();

                  for (const [ref, val] of newConds.concat([[id, newVal]])) {
                    const oldVal = conds.get(ref);

                    if (oldVal !== undefined) {
                      if (oldVal !== val) {
                        return [];
                      }
                    } else {
                      conds.set(ref, val);
                    }
                  }

                  conds.asImmutable();

                  return [{ argVals: [...argVals, newVal], conds }];
                })
              ),
            [
              {
                argVals: [] as Value[],
                conds: I.Map<Id, Value>()
              }
            ]
          )
          .map(({ argVals, conds }) => {
            const val = fn(...(argVals as any));
            return new PossibleValue({ val, conds });
          })
      )
    );
  }

  toJSON(): unknown {
    return this.id;
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
            .sort(([lRef, lVal], [rRef, rVal]) =>
              lRef === rRef ? lVal - rVal : lRef.localeCompare(rRef)
            )
        }))
    };
  }

  values(): Value[] {
    return this.toJS().vals.map((p) => p.val);
  }

  conditions(): [Id, Value][][] {
    return this.toJS().vals.map((p) => p.conds);
  }
}

const $fn = ValueSet.fn;
const $val = ValueSet.val;
export { $fn as fn, $val as val };
