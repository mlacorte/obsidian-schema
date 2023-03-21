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

export const builtin: Record<string, T.FunctionType> = {};
