/* eslint-disable no-labels */
import { $never, type IKey, type SingleType, type Type } from "./types";
import { cartesian, Cmp } from "./util";

export interface IPotentialType<K extends IKey = IKey> {
  type: SingleType<K>;
  conds: Map<TypeSet, SingleType>;
}

export class TypeSet {
  constructor(public potentials: IPotentialType[] = []) {}

  type(): Type {
    return this.potentials.reduce<Type>((res, p) => res.or(p.type), $never);
  }

  clone(): TypeSet {
    return new TypeSet(
      this.potentials.map((old) => {
        const conds = new Map<TypeSet, SingleType>();
        for (const [id, type] of old.conds) {
          conds.set(id, type.clone());
        }
        return { type: old.type.clone(), conds };
      })
    );
  }

  static val(value: Type): TypeSet {
    const types = [...value.splitTypes()];
    const res = new TypeSet();

    if (types.length === 1) {
      res.potentials.push({ type: types[0], conds: new Map() });

      return res;
    }

    for (const type of types) {
      res.potentials.push({ type, conds: new Map([[res, type]]) });
    }

    return res;
  }

  static call(
    args: TypeSet[],
    fn: (...args: Array<SingleType<any>>) => Type
  ): TypeSet {
    if (args.length === 0) {
      return TypeSet.val(fn());
    }

    const res = new TypeSet();
    const argCombos = cartesian(
      args.map((arg) =>
        arg.potentials.map((possible) => ({ id: arg, ...arg, ...possible }))
      )
    );

    outer: for (const argCombo of argCombos) {
      const conds = new Map<TypeSet, SingleType>();

      for (const arg of argCombo) {
        const curr = conds.get(arg.id);

        if (curr === undefined) {
          conds.set(arg.id, arg.type);
        } else if (curr.cmp(arg.type) !== Cmp.Equal) {
          continue outer;
        }

        for (const [id, val] of arg.conds) {
          const prev = conds.get(id);

          if (prev === undefined) {
            conds.set(id, val);
          } else if (prev.cmp(val) !== Cmp.Equal) {
            continue outer;
          }
        }
      }

      const fnRes = fn(...args.map((branch) => conds.get(branch)!));
      const types = [...fnRes.splitTypes()];

      if (types.length === 1) {
        res.potentials.push({ type: types[0], conds });
        continue;
      }

      for (const type of types) {
        res.potentials.push({ type, conds: new Map(conds).set(res, type) });
      }
    }

    return res;
  }
}
