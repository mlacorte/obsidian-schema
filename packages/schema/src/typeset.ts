/* eslint-disable no-labels */
import { type IContext } from "./context";
import {
  $never,
  type IKey,
  type ISingleTypeMap,
  type SingleType,
  type Type
} from "./types";
import { cartesian, Cmp } from "./util";

export type id = bigint;

export interface IPotentialType<K extends IKey = IKey> {
  type: SingleType<K>;
  conds: Map<id, SingleType>;
}

export class TypeSet {
  constructor(
    public id: id,
    public potentials: IPotentialType[]
  ) {}

  static ctr = BigInt(1);

  type(): Type {
    return this.potentials.reduce<Type>((res, p) => res.or(p.type), $never);
  }

  clone(): TypeSet {
    return new TypeSet(
      this.id,
      this.potentials.map((old) => {
        const conds = new Map<id, SingleType>();
        for (const [id, type] of old.conds) {
          conds.set(id, type.clone());
        }
        return { type: old.type.clone(), conds };
      })
    );
  }

  static val(value: Type): TypeSet {
    const id = TypeSet.ctr++;
    const types = [...value.splitTypes()];
    const potentials: IPotentialType[] = [];

    if (types.length === 1) {
      potentials.push({ type: types[0], conds: new Map() });

      return new TypeSet(id, potentials);
    }

    for (const type of types) {
      potentials.push({ type, conds: new Map([[id, type]]) });
    }

    return new TypeSet(id, potentials);
  }

  static call(
    args: TypeSet[],
    fn: (...args: Array<SingleType<any>>) => Type
  ): TypeSet {
    if (args.length === 0) {
      return TypeSet.val(fn());
    }

    const id = TypeSet.ctr++;
    const potentials: IPotentialType[] = [];
    const argCombos = cartesian(
      args.map((arg) =>
        arg.potentials.map((possible) => ({ ...arg, ...possible }))
      )
    );

    outer: for (const argCombo of argCombos) {
      const conds = new Map<id, SingleType>();

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

      const res = fn(...args.map((branch) => conds.get(branch.id)!));
      const types = [...res.splitTypes()];

      if (types.length === 1) {
        potentials.push({ type: types[0], conds });
        continue;
      }

      for (const type of types) {
        potentials.push({ type, conds: new Map(conds).set(id, type) });
      }
    }

    return new TypeSet(id, potentials);
  }

  static eval(ctx: IContext, fns: TypeSet, args: TypeSet[]): TypeSet {
    for (const fn of fns.potentials) {
      if (!fn.type.is("function")) {
        return TypeSet.val(
          $never(`'${fn.type.toString()}' is not a function.`)
        );
      }
    }

    const id = TypeSet.ctr++;
    const potentials: IPotentialType[] = [];

    for (const fn of fns.potentials) {
      const fnVal = fn.type.value as ISingleTypeMap["function"];

      const filtered = args.map((arg) => {
        const args: IPotentialType[] = [];

        outer: for (let { type, conds } of arg.potentials) {
          conds = new Map(conds);
          const self = conds.get(fns.id);

          if (self === undefined) {
            conds.set(fns.id, fn.type);
          } else if (self.cmp(fn.type) !== Cmp.Equal) {
            continue outer;
          }

          for (const [id, cond] of fn.conds) {
            const curr = conds.get(id);

            if (curr === undefined) {
              conds.set(id, cond);
            } else if (curr.cmp(cond) !== Cmp.Equal) {
              continue outer;
            }
          }

          args.push({ type, conds });
        }

        return new TypeSet(arg.id, args);
      });

      potentials.push(...fnVal(ctx, ...filtered).potentials);
    }

    return new TypeSet(id, potentials);
  }
}
