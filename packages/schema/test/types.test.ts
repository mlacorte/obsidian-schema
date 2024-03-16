import { builtins } from "../src/builtins";
import { Context } from "../src/context";
import {
  $any,
  $array,
  $boolean,
  $false,
  $never,
  $null,
  $number,
  $object,
  $string,
  $true,
  isType,
  StringFns,
  type Type
} from "../src/types";
import { TypeSet } from "../src/typeset";
import * as UtilFns from "../src/util";

const $one = $number(1);
const $two = $number(2);
const $three = $number(3);

const eq = (a: Type, b: Type): void => {
  expect(a.toString()).toBe(b.toString());
};

describe("util", () => {
  const { _cmp, _or, _and } = StringFns;
  const { Cmp, and, or, cmp } = UtilFns;

  const as = ["a", "b", "c"];
  const bs = ["b", "c", "d"];

  describe("or", () => {
    test("forward", () => {
      const forward = [...or(as, bs, _or)];
      expect(forward).toEqual(["a", "b", "c", "d"]);
    });
    test("reversed", () => {
      const reversed = [...or(bs, as, _or)];
      expect(reversed).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("and", () => {
    test("forward", () => {
      const forward = [...and(as, bs, _and, _cmp)];
      expect(forward).toEqual(["b", "c"]);
    });
    test("reversed", () => {
      const reversed = [...and(bs, as, _and, _cmp)];
      expect(reversed).toEqual(["b", "c"]);
    });
  });

  describe("cmp", () => {
    const abc = ["a", "b", "c"];
    const ab = ["a", "b"];
    const bc = ["b", "c"];
    const b = ["b"];

    test("equal", () => {
      expect(cmp(abc, abc, _cmp)).toBe(Cmp.Equal);
    });

    test("superset", () => {
      expect(cmp(abc, ab, _cmp)).toBe(Cmp.Superset);
      expect(cmp(abc, bc, _cmp)).toBe(Cmp.Superset);
      expect(cmp(abc, b, _cmp)).toBe(Cmp.Superset);
    });

    test("subset", () => {
      expect(cmp(ab, abc, _cmp)).toBe(Cmp.Subset);
      expect(cmp(bc, abc, _cmp)).toBe(Cmp.Subset);
      expect(cmp(b, abc, _cmp)).toBe(Cmp.Subset);
    });

    test("disjoint", () => {
      expect(cmp(ab, bc, _cmp)).toBe(Cmp.DisjointGt);
      expect(cmp(bc, ab, _cmp)).toBe(Cmp.DisjointLt);
    });
  });

  describe("cartesian", () => {
    const cartesian = <T>(a: T[][]): T[][] => [...UtilFns.cartesian(a)];

    test("single", () => {
      const input = [[1], [2], [3]];
      const output = [...UtilFns.cartesian(input)];
      expect(output).toEqual([[1, 2, 3]]);
    });

    test("double", () => {
      expect(cartesian([[0, 1], [2], [3]])).toEqual([
        [0, 2, 3],
        [1, 2, 3]
      ]);
    });

    test("double-double", () => {
      expect(cartesian([[0, 1], [2], [3, 4]])).toEqual([
        [0, 2, 3],
        [1, 2, 3],
        [0, 2, 4],
        [1, 2, 4]
      ]);
    });
  });
});

describe("typeset", () => {
  describe("boolean", () => {
    test("promotion", () => {
      eq($true.or($false), $boolean);
    });
  });

  describe("unions", () => {
    const $a = $string("a");

    test("or", () => {
      eq($a.or($number), $number.or($a));
    });

    test("and", () => {
      eq($a.and($number), $never.andError($a, $number));
    });
  });

  describe("any", () => {
    test("or", () => {
      eq($any.or($string), $any);
    });

    test("and", () => {
      eq($any.and($string), $string);
    });
  });

  describe("never", () => {
    test("or", () => {
      eq($never.or($number), $number);
    });

    test("and", () => {
      eq($never.and($number), $never);
    });
  });

  describe("null", () => {
    describe("or", () => {
      test("self", () => {
        eq($null.or($null), $null);
      });
      test("other", () => {
        eq($null.or($number).and($null), $null);
      });
    });

    describe("and", () => {
      test("self", () => {
        eq($null.and($null), $null);
      });
      test("other", () => {
        eq($null.and($number), $never.andError($null, $number));
      });
    });
  });

  describe("objects", () => {
    const $a12 = $object({ a: $one.or($two) }, $any);
    const $a1 = $object({ a: $one }, $any);
    const $a1b2 = $object({ a: $one, b: $two }, $any);
    const $a23 = $object({ a: $two.or($three) }, $any);

    describe("identity", () => {
      test("or", () => {
        eq($a12.or($a12), $a12);
      });
      test("and", () => {
        eq($a12.and($a12), $a12);
      });
    });

    describe("subset", () => {
      test("or", () => {
        eq($a12.or($a1b2), $object({ a: $one.or($two), b: $any }, $any));
      });
      test("and", () => {
        eq($a12.and($a1), $a1);
        eq($a12.and($a1b2), $object({ a: $one, b: $two }, $any));
      });
    });

    describe("intersect", () => {
      test("or", () => {
        eq($a12.or($a23), $object({ a: $one.or($two).or($three) }, $any));
      });

      test("and", () => {
        eq($a12.and($a23), $object({ a: $two }, $any));
      });
    });

    describe("disjoint", () => {
      test("and", () => {
        expect($a1.and($a23).type).toEqual("never");
      });
    });
  });

  describe("lists", () => {
    const $a12 = $array([$one.or($two)], $any);
    const $a1 = $array([$one], $any);
    const $a1b2 = $array([$one, $two], $any);
    const $a23 = $array([$two.or($three)], $any);

    describe("identity", () => {
      test("or", () => {
        eq($a12.or($a12), $a12);
      });
      test("and", () => {
        eq($a12.and($a12), $a12);
      });
    });

    describe("subset", () => {
      test("or", () => {
        eq($a12.or($a1b2), $array([$one.or($two), $any], $any));
      });
      test("and", () => {
        eq($a12.and($a1), $a1);
        eq($a12.and($a1b2), $array([$one, $two], $any));
      });
    });

    describe("intersect", () => {
      test("or", () => {
        eq($a12.or($a23), $array([$one.or($two).or($three)], $any));
      });

      test("and", () => {
        eq($a12.and($a23), $array([$two], $any));
      });
    });

    describe("disjoint", () => {
      test("and", () => {
        expect($a1.and($a23).type).toEqual("never");
      });
    });
  });

  describe("functions", () => {
    const lit = (arg: Type | Type[]): Type => (isType(arg) ? arg : $array(arg));
    const or = (...args: Array<Type | Type[]>): Type =>
      args.map(lit).reduce((a, b) => a.or(b), $never);

    const tests = [
      [$true, $one, $two, $one],
      [[$true, $false], $one, $two, [$one, $two]],
      [$boolean, [$string, $one], $number, [$string.or($number), $number]],
      [
        $array([], $boolean),
        [$string, $one],
        $number,
        or([], [$string.or($number)], [$string.or($number), $number])
      ],
      [
        $array([], $boolean),
        $array([], $string.or($one)),
        $number,
        $array([], $number.or($string))
      ],
      [
        $array([], $boolean),
        $array([$string, $one], $number),
        $number,
        or(
          [],
          [$string.or($number)],
          $array([$string.or($number), $number], $number)
        )
      ]
    ].map((row) => row.map(lit) as [Type, Type, Type, Type]);

    const ctx = new Context().empty();

    test("boolean splitting", () => {
      expect([...$array([], $boolean).splitTypes()].length).toBe(2);
    });

    for (const types of tests) {
      const args = types.slice(0, 3).map((t) => TypeSet.val(ctx, t));
      const s = types.map((t) => t.toString());
      const name = `choice(${s[0]}, ${s[1]}, ${s[2]}) => ${s[3]}`;

      test(name, () => {
        eq(builtins.choice.value(ctx, ...args).type(), types[3]);
      });
    }
  });
});
