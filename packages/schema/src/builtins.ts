/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  $any,
  $boolean,
  $link,
  $never,
  $null,
  $number,
  $string,
  define,
  type SingleType
} from "./types";

const lt = define("lt", [])
  .add([$any, $any], (_, a, b) => $boolean(a.cmp(b, true) < 0))
  .build();

const lte = define("lte", [])
  .add([$any, $any], (_, a, b) => $boolean(a.cmp(b, true) <= 0))
  .build();

const gt = define("gt", [])
  .add([$any, $any], (_, a, b) => $boolean(a.cmp(b, true) > 0))
  .build();

const gte = define("gte", [])
  .add([$any, $any], (_, a, b) => $boolean(a.cmp(b, true) >= 0))
  .build();

const eq = define("eq", [])
  .add([$any, $any], (_, a, b) => $boolean(a.cmp(b, true) === 0))
  .build();

const neq = define("neq", [])
  .add([$any, $any], (_, a, b) => $boolean(a.cmp(b, true) !== 0))
  .build();

// TODO: make this dataview compliant
const plus = define("neq", [])
  .add([$number, $number], $number, [0, 1], (_, a: number, b: number) =>
    $number(a + b)
  )
  .build();

export const ops = { lt, lte, gt, gte, eq, neq, plus };

const choice = define("choice", [0, 1, 2])
  .add([$boolean, $any, $any], (_, cond: SingleType<"boolean">, pass, fail) =>
    cond.value! ? pass : fail
  )
  .build();

const elink = define("elink", [0])
  .add([$string, $string], $link, [0, 1], () => $never("TODO"))
  .add([$string, [$null]], () => $never("TODO"))
  .add([$null, [$any]], () => $never("TODO"))
  .build();

export const builtins = { choice, elink };
