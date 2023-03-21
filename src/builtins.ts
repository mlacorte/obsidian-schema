import { Widgets } from "obsidian-dataview";

import * as T from "./types";

export const op: Record<string, T.FunctionType> = {
  lte: T.Function.define("lte", [])
    .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'lte'"))
    .build(),

  gt: T.Function.define("gt", [])
    .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'gt'"))
    .build(),

  gte: T.Function.define("gte", [])
    .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'gte'"))
    .build(),

  eq: T.Function.define("eq", [])
    .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'eq'"))
    .build(),

  neq: T.Function.define("neq", [])
    .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'neq'"))
    .build()
};

export const fn: Record<string, T.FunctionType> = {
  choice: T.Function.define("choice", [0, 1, 2])
    .add(
      [T.Boolean, T.Any, T.Any],
      (cond: T.BooleanType, pass: T.Type, fail: T.Type) =>
        cond.isType() ? pass.or(fail) : cond.value ? pass : fail
    )
    .build(),

  elink: T.Function.define("elink", [0])
    .add([T.String, T.String], T.Link, [0, 1], (a: string, d: string) =>
      T.Widget.literal(Widgets.externalLink(a, d))
    )
    .add([T.String, [T.Null]], (s: T.StringType) => fn.elink.eval(s, s))
    .add([T.Null, [T.Any]], () => T.Null)
    .build()
};
