import { describe, expect, test } from "bun:test";

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
  NeverFns,
  StringFns,
  type Type
} from "./typeset";
import * as UtilFns from "./util";

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
      eq(
        $a.and($number),
        $never.error(NeverFns.error($a.value, $number.value))
      );
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
        eq(
          $null.and($number),
          $never.error(NeverFns.error($null.value, $number.value))
        );
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
        expect($a1.and($a23).value[0].type).toEqual("never");
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
        expect($a1.and($a23).value[0].type).toEqual("never");
      });
    });
  });
});
