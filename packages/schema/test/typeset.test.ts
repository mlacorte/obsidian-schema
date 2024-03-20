import { $number, type SingleType } from "../src/types";
import { TypeSet } from "../src/typeset";

const $one = $number(1);
const $two = $number(2);
const $three = $number(3);
const $four = $number(4);
const $five = $number(5);
const $six = $number(6);

const valEq = (a: TypeSet, b: SingleType[]): void => {
  expect(
    [...a.potentials.values()].map((t) => t.type).map((t) => t.types)
  ).toEqual(b.map((t) => t.types));
};

const depEq = (a: TypeSet, b: Array<Array<[TypeSet, SingleType]>>): void => {
  expect(
    [...a.potentials.values()].map((p) =>
      [...p.conds].map(([id, t]) => [id, t.types])
    )
  ).toEqual(b.map((p) => p.map(([ts, t]) => [ts.id, t.types])));
};

describe("valueset", () => {
  const a = TypeSet.val($one.or($two));
  const b = TypeSet.val($one.or($two));
  const empty = TypeSet.call([], () => $one);
  const different = TypeSet.call(
    [a, b],
    (a: SingleType<"number">, b: SingleType<"number">) =>
      $number(a.value! + b.value!)
  );
  const same = TypeSet.call(
    [a, a],
    (a: SingleType<"number">, b: SingleType<"number">) =>
      $number(a.value! + b.value!)
  );
  const derived = TypeSet.call(
    [a, different],
    (a: SingleType<"number">, b: SingleType<"number">) =>
      $number(a.value! + b.value!)
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
