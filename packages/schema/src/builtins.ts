import * as T from "./types";

const lte = T.Function.define("lte", [])
  .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'lte'"))
  .build();

const gt = T.Function.define("gt", [])
  .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'gt'"))
  .build();

const gte = T.Function.define("gte", [])
  .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'gte'"))
  .build();

const eq = T.Function.define("eq", [])
  .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'eq'"))
  .build();

const neq = T.Function.define("neq", [])
  .add([T.Any, T.Any], () => T.Never.error("TODO: implement 'neq'"))
  .build();

export const op = { lte, gt, gte, eq, neq };

const choice = T.Function.define("choice", [0, 1, 2])
  .add([T.Boolean, T.Any, T.Any], (cond, pass, fail) =>
    cond.isType() ? pass.or(fail) : cond.value ? pass : fail,
  )
  .build();

// const elink: T.FunctionType = T.Function.define("elink", [0])
//   .add([T.String, T.String], T.Link, [0, 1], (a: string, d: string) =>
//     T.Widget.literal(Widgets.externalLink(a, d))
//   )
//   .add([T.String, [T.Null]], (s) => elink.eval(s, s))
//   .add([T.Null, [T.Any]], () => T.Null)
//   .build();

const elink: T.FunctionType = T.Function.define("elink", [0])
  .add([T.String, T.String], T.Link, [0, 1], () => T.Never.error("TODO"))
  .add([T.String, [T.Null]], () => T.Never.error("TODO"))
  .add([T.Null, [T.Any]], () => T.Never.error("TODO"))
  .build();

export const fn = { choice, elink };
