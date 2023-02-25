import * as I from "immutable";

type Id = string;
type Value = number;

type IValueSet = { u: Id; R: I.Set<IValuePair> };
type IValuePair<T = Value> = { v: T; l: I.Set<Id> };

export function val(id: Id, vals: Value[]): IValueSet {
  return {
    u: id,
    R: I.Set(vals.map((v, i) => ({ v, l: I.Set([`${id}[${i}]`]) })))
  };
}

export function fn<Args extends IValueSet[]>(
  id: Id,
  vals: [...Args],
  fn: (...v: { [I in keyof Args]: Value }) => Value
): IValueSet {
  return {
    u: id,
    R: I.Set(
      vals
        .slice(1)
        .reduce(
          (row, val) =>
            row.flatMap((args) =>
              val.R.toArray().flatMap((arg) => {
                const l = args.l.intersect(arg.l);
                return l.isEmpty() ? [] : [{ v: [...args.v, arg.v], l }];
              })
            ),
          (vals[0]?.R.toArray() || []).map(({ v, l }) => ({ v: [v], l }))
        )
        .map(({ v, l }) => ({ v: fn(...(v as any)), l }))
    )
  };
}
