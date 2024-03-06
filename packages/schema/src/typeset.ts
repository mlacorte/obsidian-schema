/* eslint-disable no-labels */
import { type SingleType, type Type } from "./types";
import { cartesian, Cmp } from "./util";

export type id = bigint & { id: never };
let $id: id = BigInt(1) as id;

export interface TypeSet {
  id: id;
  set: IPossibleType[];
}

export interface IPossibleType {
  type: Type;
  deps: Map<id, SingleType>;
}

export const $value = (value: Type, id?: id): TypeSet => {
  id = id ?? ($id++ as id);
  const types = [...value.splitTypes()];
  const set: IPossibleType[] = [];

  for (const type of types) {
    set.push({ type, deps: new Map([[id, type]]) });
  }

  return { id, set };
};

export const $function = (
  args: TypeSet[],
  fn: (...args: Array<SingleType<any>>) => Type,
  id?: id
): TypeSet => {
  id = id ?? ($id++ as id);

  if (args.length === 0) {
    return { id, set: [{ type: fn(), deps: new Map() }] };
  }

  const set: IPossibleType[] = [];
  const argCombos = cartesian(
    args.map((arg) => arg.set.map((possible) => ({ id: arg.id, ...possible })))
  );

  outer: for (const argCombo of argCombos) {
    const deps = new Map<id, SingleType>();

    for (const arg of argCombo) {
      const curr = deps.get(arg.id);

      if (curr === undefined) {
        // TODO: figure out what to do if multiple types returned
        deps.set(arg.id, arg.type as SingleType);
      } else if (curr.cmp(arg.type) !== Cmp.Equal) {
        continue outer;
      }

      for (const [id, val] of arg.deps) {
        const prev = deps.get(id);

        if (prev === undefined) {
          deps.set(id, val);
        } else if (prev.cmp(val) !== Cmp.Equal) {
          continue outer;
        }
      }
    }

    const types = args.map((a) => deps.get(a.id)) as SingleType[];
    const type = fn(...types);
    set.push({ type, deps });
  }

  return { id, set };
};
