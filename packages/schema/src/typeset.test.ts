import { describe, expect, test } from "bun:test";

import { $number, type Type } from "./types";
import { $function, $value, type TypeSet } from "./typeset";

const $one = $number(1);
const $two = $number(2);
const $three = $number(3);
const $four = $number(4);
const $five = $number(5);
const $six = $number(6);

const values = (t: TypeSet): Type[] => [...t.set.values()].map((a) => a.type);

const deps = (t: TypeSet): Array<Array<[number, Type<any>]>> =>
  [...t.set.values()].map((a) => [...a.deps.entries()]);

describe("valueset", () => {
  const a = $value($one.or($two));
  const b = $value($one.or($two));
  const empty = $function([], () => $one);
  const different = $function([a, b], (a: Type<"number">, b: Type<"number">) =>
    $number(a.value! + b.value!)
  );
  const same = $function([a, a], (a: Type<"number">, b: Type<"number">) =>
    $number(a.value! + b.value!)
  );
  const derived = $function(
    [a, different],
    (a: Type<"number">, b: Type<"number">) => $number(a.value! + b.value!)
  );

  test("empty", () => {
    expect(values(empty)).toMatchObject([$one]);
    expect(deps(empty)).toMatchObject([[]]);
  });

  describe("unit", () => {
    test("a", () => {
      expect(values(a)).toMatchObject([$one, $two]);
      expect(deps(a)).toMatchObject([[[a.id, $one]], [[a.id, $two]]]);
    });

    test("b", () => {
      expect(values(b)).toMatchObject([$one, $two]);
      expect(deps(b)).toMatchObject([[[b.id, $one]], [[b.id, $two]]]);
    });

    test("ids", () => {
      expect(a.id).not.toBe(b.id);
    });
  });

  test("different", () => {
    expect(values(different)).toMatchObject([$two, $three, $three, $four]);
    expect(deps(different)).toMatchObject([
      [
        [a.id, $one],
        [b.id, $one]
      ],
      [
        [a.id, $two],
        [b.id, $one]
      ],
      [
        [a.id, $one],
        [b.id, $two]
      ],
      [
        [a.id, $two],
        [b.id, $two]
      ]
    ]);
  });

  test("same", () => {
    expect(values(same)).toMatchObject([$two, $four]);
    expect(deps(same)).toMatchObject([[[a.id, $one]], [[a.id, $two]]]);
  });

  test("derived", () => {
    expect(values(derived).map((a) => a.toString())).toMatchObject(
      [$three, $five, $four, $six].map((t) => t.toString())
    );
    expect(deps(derived)).toMatchObject([
      [
        [a.id, $one],
        [different.id, $two],
        [b.id, $one]
      ],
      [
        [a.id, $two],
        [different.id, $three],
        [b.id, $one]
      ],
      [
        [a.id, $one],
        [different.id, $three],
        [b.id, $two]
      ],
      [
        [a.id, $two],
        [different.id, $four],
        [b.id, $two]
      ]
    ]);
  });
});
