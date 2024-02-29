/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  $any,
  $boolean,
  $link,
  $never,
  $null,
  $string,
  define,
  type Type
} from "./types";

const lte = define("lte", [])
  .add([$any, $any], (a, b) => $boolean(a.cmp(b, true) <= 0))
  .build();

const gt = define("gt", [])
  .add([$any, $any], (a, b) => $boolean(a.cmp(b, true) > 0))
  .build();

const gte = define("gte", [])
  .add([$any, $any], (a, b) => $boolean(a.cmp(b, true) >= 0))
  .build();

const eq = define("eq", [])
  .add([$any, $any], (a, b) => $boolean(a.cmp(b, true) === 0))
  .build();

const neq = define("neq", [])
  .add([$any, $any], (a, b) => $boolean(a.cmp(b, true) !== 0))
  .build();

export const $op = { lte, gt, gte, eq, neq };

const choice = define("choice", [0, 1, 2])
  .add([$boolean, $any, $any], (cond: Type<"boolean">, pass, fail) =>
    cond.isType() ? pass.or(fail) : cond.value! ? pass : fail
  )
  .build();

const elink = define("elink", [0])
  .add([$string, $string], $link, [0, 1], () => $never("TODO"))
  .add([$string, [$null]], () => $never("TODO"))
  .add([$null, [$any]], () => $never("TODO"))
  .build();

export const $fn = { choice, elink };
