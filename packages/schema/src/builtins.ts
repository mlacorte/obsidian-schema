/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  $any,
  $array,
  $boolean,
  $date,
  $duration,
  $link,
  $never,
  $null,
  $number,
  $object,
  $string,
  define,
  DurationFns,
  type SingleType as T
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

const plus = define("plus", [])
  .add(
    [$number, $number],
    $number,
    [0, 1],
    (_, a: T<"number">, b: T<"number">) => $number(a.value! + b.value!)
  )
  .add([$string, $any], $string, [0, 1], (_, a: T<"string">, b) =>
    $string(a.value! + b.toString())
  )
  .add([$any, $string], $string, [0, 1], (_, a, b: T<"string">) =>
    $string(a.toString() + b.value!)
  )
  .add([$date, $duration], $date, [0, 1], (_, a: T<"date">, b: T<"duration">) =>
    $date(a.value!.plus(b.value!))
  )
  .add(
    [$duration, $duration],
    $duration,
    [0, 1],
    (_, a: T<"duration">, b: T<"duration">) =>
      $duration(DurationFns.normalize(a.value!.plus(b.value!)))
  )
  .add([$array, $array], $array, [0, 1], (_, a: T<"array">, b: T<"array">) =>
    $array(
      [...a.value.known, ...b.value.known],
      a.value.unknown.or(b.value.unknown)
    )
  )
  .add(
    [$object, $object],
    $object,
    [0, 1],
    (_, a: T<"object">, b: T<"object">) =>
      $object(
        Object.fromEntries([...a.value.known, ...b.value.known]),
        a.value.unknown.or(b.value.unknown)
      )
  )
  .add([$null, $null], () => $null)
  .add([$date, $null], () => $null)
  .add([$null, $date], () => $null)
  .build();

export const ops = { lt, lte, gt, gte, eq, neq, plus };

const choice = define("choice", [0, 1, 2])
  .add([$boolean, $any, $any], (_, cond: T<"boolean">, pass, fail) =>
    cond.value! ? pass : fail
  )
  .build();

const elink = define("elink", [0])
  .add([$string, $string], $link, [0, 1], () => $never("TODO"))
  .add([$string, [$null]], () => $never("TODO"))
  .add([$null, [$any]], () => $never("TODO"))
  .build();

export const builtins = { choice, elink };
