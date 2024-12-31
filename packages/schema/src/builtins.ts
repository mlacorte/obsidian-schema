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
      $duration(a.value!.plus(b.value!), true)
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

const minus = define("minus", [])
  .add(
    [$number, $number],
    $number,
    [0, 1],
    (_, a: T<"number">, b: T<"number">) => $number(a.value! - b.value!)
  )
  .add([$date, $date], $duration, [0, 1], (_, a: T<"date">, b: T<"date">) =>
    $duration(
      a.value!.diff(b.value!, [
        "years",
        "months",
        "days",
        "hours",
        "minutes",
        "seconds",
        "milliseconds"
      ]),
      true
    )
  )
  .add([$date, $duration], $date, [0, 1], (_, a: T<"date">, b: T<"duration">) =>
    $date(a.value!.minus(b.value!))
  )
  .add(
    [$duration, $duration],
    $duration,
    [0, 1],
    (_, a: T<"duration">, b: T<"duration">) =>
      $duration(a.value!.minus(b.value!), true)
  )
  .add([$null, $null], () => $null)
  .add([$date, $null], () => $null)
  .add([$null, $date], () => $null)
  .build();

const multiply = define("multiply", [])
  .add(
    [$number, $number],
    $number,
    [0, 1],
    (_, a: T<"number">, b: T<"number">) => $number(a.value! * b.value!)
  )
  .add(
    [$duration, $number],
    $duration,
    [0, 1],
    (_, a: T<"duration">, b: T<"number">) =>
      $duration(
        a.value!.mapUnits((x) => b.value! * x),
        true
      )
  )
  .add([$null, $null], () => $null)
  .build();

const divide = define("divide", [])
  .add(
    [$number, $number],
    $number,
    [0, 1],
    (_, a: T<"number">, b: T<"number">) => $number(a.value! / b.value!)
  )
  .add(
    [$duration, $number],
    $duration,
    [0, 1],
    (_, a: T<"duration">, b: T<"number">) =>
      $duration(
        a.value!.mapUnits((x) => b.value! / x),
        true
      )
  )
  .add([$null, $null], () => $null)
  .build();

const modulo = define("modulo", [])
  .add(
    [$number, $number],
    $number,
    [0, 1],
    (_, a: T<"number">, b: T<"number">) => $number(a.value! % b.value!)
  )
  .add([$null, $null], () => $null)
  .build();

export const ops = {
  lt,
  lte,
  gt,
  gte,
  eq,
  neq,
  plus,
  minus,
  multiply,
  divide,
  modulo
};

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
