/* eslint-disable no-labels */
import { type SingleType, type Type } from "./types";
import { cartesian, Cmp } from "./util";

export type id = bigint;

export interface TypeSet {
  id: id;
  potentials: IPotentialType[];
  deps: Set<id>;
  reverseDeps: Set<id>;
  clone: () => TypeSet;
}

export interface IPotentialType {
  type: SingleType;
  conds: Map<id, SingleType>;
}

const withClone = (self: Omit<TypeSet, "clone">): TypeSet => {
  (self as TypeSet).clone = (): TypeSet => {
    return withClone({
      id: self.id,
      potentials: self.potentials.map((old) => {
        const conds = new Map<id, SingleType>();
        for (const [id, type] of old.conds) {
          conds.set(id, type.clone());
        }
        return { type: old.type.clone(), conds };
      }),
      deps: new Set(self.deps),
      reverseDeps: new Set(self.reverseDeps)
    });
  };

  return self as TypeSet;
};

export const $val = (id: id, value: Type): TypeSet => {
  const types = [...value.splitTypes()];
  const potentials: IPotentialType[] = [];

  if (types.length === 1) {
    potentials.push({ type: types[0], conds: new Map() });

    return withClone({
      id,
      potentials,
      deps: new Set(),
      reverseDeps: new Set()
    });
  }

  for (const type of types) {
    potentials.push({ type, conds: new Map([[id, type]]) });
  }

  return withClone({
    id,
    potentials,
    deps: new Set([id]),
    reverseDeps: new Set()
  });
};

export const $fn = (
  id: id,
  args: TypeSet[],
  fn: (...args: Array<SingleType<any>>) => Type
): TypeSet => {
  if (args.length === 0) {
    return $val(id, fn());
  }

  const potentials: IPotentialType[] = [];
  const deps = new Set<id>();
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

    // add self as reverseDep to valid argCombo args
    for (const arg of argCombo) {
      arg.reverseDeps.add(id);
    }

    const res = fn(...args.map((branch) => conds.get(branch.id)!));
    const types = [...res.splitTypes()];

    // add conditions to deps
    for (const depId of conds.keys()) {
      deps.add(depId);
    }

    if (types.length === 1) {
      potentials.push({ type: types[0], conds });
      continue;
    }

    // if union type, add self too
    deps.add(id);

    for (const type of types) {
      potentials.push({
        type,
        conds: new Map(conds).set(id, type)
      });
    }
  }

  return withClone({ id, potentials, deps, reverseDeps: new Set() });
};
