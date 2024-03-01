import { $number, type Type } from "../src/types";
import { $function, $value, type TypeSet } from "../src/typeset";

const $one = $number(1);
const $two = $number(2);
const $three = $number(3);
const $four = $number(4);
const $five = $number(5);
const $six = $number(6);

const valEq = (a: TypeSet, b: Type[]): void => {
  expect([...a.set.values()].map((t) => t.type).map((t) => t.types)).toEqual(
    b.map((t) => t.types)
  );
};

const depEq = (a: TypeSet, b: Array<Array<[TypeSet, Type]>>): void => {
  expect(
    [...a.set.values()].map((p) => [...p.deps].map(([id, t]) => [id, t.types]))
  ).toEqual(b.map((p) => p.map(([ts, t]) => [ts.id, t.types])));
};

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
    valEq(empty, [$one]);
    depEq(empty, [[]]);
  });

  describe("unit", () => {
    test("a", () => {
      valEq(a, [$one, $two]);
      depEq(a, [[[a, $one]], [[a, $two]]]);
    });

    test("b", () => {
      valEq(b, [$one, $two]);
      depEq(b, [[[b, $one]], [[b, $two]]]);
    });

    test("ids", () => {
      expect(a.id).not.toBe(b.id);
    });
  });

  test("different", () => {
    valEq(different, [$two, $three, $three, $four]);
    depEq(different, [
      [
        [a, $one],
        [b, $one]
      ],
      [
        [a, $two],
        [b, $one]
      ],
      [
        [a, $one],
        [b, $two]
      ],
      [
        [a, $two],
        [b, $two]
      ]
    ]);
  });

  test("same", () => {
    valEq(same, [$two, $four]);
    depEq(same, [[[a, $one]], [[a, $two]]]);
  });

  test("derived", () => {
    valEq(derived, [$three, $five, $four, $six]);
    depEq(derived, [
      [
        [a, $one],
        [different, $two],
        [b, $one]
      ],
      [
        [a, $two],
        [different, $three],
        [b, $one]
      ],
      [
        [a, $one],
        [different, $three],
        [b, $two]
      ],
      [
        [a, $two],
        [different, $four],
        [b, $two]
      ]
    ]);
  });
});
