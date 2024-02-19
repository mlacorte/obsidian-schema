import I from "immutable";

import * as T from "./types";

class PossibleValue extends I.Record({
  val: T.Never.error("ValueSet incorrectly initialized.") as T.Type,
  conds: I.Map<string, T.Type>()
}) {}

let $id = 1;

class ValueSet {
  private readonly _id: number;
  private readonly vals!: I.Set<PossibleValue>;

  get id(): string {
    return `<${this.name}:${this._id}>`;
  }

  private constructor(
    public readonly name: string,
    fn: (self: ValueSet) => I.Set<PossibleValue>
  ) {
    this._id = $id++;
    this.vals = fn(this);
  }

  private static new(
    name: string,
    fn: (self: ValueSet) => I.Set<PossibleValue>
  ): ValueSet {
    return new ValueSet(name, fn);
  }

  static val(name: string, vals: T.Type[]): ValueSet {
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
    fn: (...vals: { [I in keyof Args]: T.Type }) => T.Type
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
                  const conds: I.Map<string, T.Type> = oldConds.asMutable();

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
                argVals: [] as T.Type[],
                conds: I.Map<string, T.Type>()
              }
            ]
          )
          .map(({ argVals, conds }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
    id: string;
    vals: Array<{ val: T.Type; conds: Array<[string, T.Type]> }>;
  } {
    return {
      id: this.id,
      vals: this.vals
        .toArray()
        .sort((l, r) =>
          `${l.val.toString()}`.localeCompare(`${r.val.toString()}`)
        )
        .map((p) => ({
          val: p.val,
          conds: p.conds
            .toArray()
            .sort(([lRef, lVal], [rRef, rVal]) =>
              lRef === rRef
                ? `${lVal.toString()}`.localeCompare(`${rVal.toString()}`)
                : lRef.localeCompare(rRef)
            )
        }))
    };
  }

  values(): T.Type[] {
    return this.toJS().vals.map((p) => p.val);
  }

  conditions(): Array<Array<[string, T.Type]>> {
    return this.toJS().vals.map((p) => p.conds);
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
const $fn = ValueSet.fn;
// eslint-disable-next-line @typescript-eslint/unbound-method
const $val = ValueSet.val;
export { $fn as fn, $val as val };
