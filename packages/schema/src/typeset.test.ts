/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, test } from "bun:test";

import { type IType, NeverFns, StringFns, TypeFns } from "./typeset";
import * as UtilFns from "./util";

const list = (...known: IType[]): IType => [
  ["array", { unknown: ["any"], known }]
];

const eq = (a: IType, b: IType): void => {
  expect(TypeFns.string(a)).toBe(TypeFns.string(b));
};

describe("util", () => {
  const { _compare, _cmp, _or, _and } = StringFns;
  const { Cmp, and, or, cmp } = UtilFns;

  const as = ["a", "b", "c"];
  const bs = ["b", "c", "d"];

  describe("or", () => {
    test("forward", () => {
      const forward = [...or(as, bs, _or, _compare)];
      expect(forward).toEqual(["a", "b", "c", "d"]);
    });
    test("reversed", () => {
      const reversed = [...or(bs, as, _or, _compare)];
      expect(reversed).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("and", () => {
    test("forward", () => {
      const forward = [...and(as, bs, _and, _compare)];
      expect(forward).toEqual(["b", "c"]);
    });
    test("reversed", () => {
      const reversed = [...and(bs, as, _and, _compare)];
      expect(reversed).toEqual(["b", "c"]);
    });
  });

  describe("cmp", () => {
    const abc = ["a", "b", "c"];
    const ab = ["a", "b"];
    const bc = ["b", "c"];
    const b = ["b"];

    test("equal", () => {
      expect(cmp(abc, abc, _compare, _cmp)).toBe(Cmp.Equal);
    });

    test("superset", () => {
      expect(cmp(abc, ab, _compare, _cmp)).toBe(Cmp.Superset);
      expect(cmp(abc, bc, _compare, _cmp)).toBe(Cmp.Superset);
      expect(cmp(abc, b, _compare, _cmp)).toBe(Cmp.Superset);
    });

    test("subset", () => {
      expect(cmp(ab, abc, _compare, _cmp)).toBe(Cmp.Subset);
      expect(cmp(bc, abc, _compare, _cmp)).toBe(Cmp.Subset);
      expect(cmp(b, abc, _compare, _cmp)).toBe(Cmp.Subset);
    });

    test("disjoint", () => {
      expect(cmp(ab, bc, _compare, _cmp)).toBe(Cmp.Disjoint);
      expect(cmp(bc, ab, _compare, _cmp)).toBe(Cmp.Disjoint);
    });
  });
});

describe("typeset", () => {
  const { and, or } = TypeFns;
  const { error } = NeverFns;

  describe("boolean", () => {
    test("promotion", () => {
      const promotion = or([["boolean", true]], [["boolean", false]]);
      eq(promotion, [["boolean", null]]);
    });
  });

  describe("unions", () => {
    const strVal: IType = [["string", "a"]];
    const numType: IType = [["number", null]];

    test("or", () => {
      eq(or(strVal, numType), [...numType, ...strVal]);
    });

    test("and", () => {
      eq(and(strVal, numType), error(strVal, numType));
    });
  });

  describe("any", () => {
    const any: IType = ["any"];
    const string: IType = [["string", null]];

    test("or", () => {
      eq(or(any, string), ["any"]);
    });

    test("and", () => {
      eq(and(any, string), [["string", null]]);
    });
  });

  describe("never", () => {
    const never: IType = ["never"];
    const number: IType = [["number", 1]];

    test("or", () => {
      eq(or(never, number), [["number", 1]]);
    });

    test("and", () => {
      eq(and(never, number), ["never"]);
    });
  });

  describe("null", () => {
    const $null: IType = [["null", null]];
    const num: IType = [["number", null]];

    describe("or", () => {
      test("self", () => {
        eq(or($null, $null), $null);
      });
      test("other", () => {
        eq(or($null, num), [...$null, ...num]);
      });
    });

    describe("and", () => {
      test("self", () => {
        eq(and($null, $null), $null);
      });
      test("other", () => {
        eq(and($null, num), error($null, num));
      });
    });
  });

  describe("lists", () => {
    const one: IType = [["number", 1]];
    const two: IType = [["number", 2]];
    const three: IType = [["number", 3]];

    const a = list(or(one, two));
    const b = list(one);
    const c = list(one, two);
    const d = list(or(two, three));

    describe("identity", () => {
      test("or", () => {
        eq(or(a, a), a);
      });
      test("and", () => {
        eq(and(a, a), a);
      });
    });

    describe("subset", () => {
      test("or", () => {
        eq(or(a, c), list(or(one, two), ["any"]));
      });
      test("and", () => {
        eq(and(a, b), b);
        eq(and(a, c), list(one, two));
      });
    });

    describe("intersect", () => {
      test("or", () => {
        eq(or(a, d), list(or(one, or(two, three))));
      });

      test("and", () => {
        eq(and(a, d), list(two));
      });
    });

    describe("disjoint", () => {
      expect(and(b, d)[0]).toEqual("never");
    });
  });
});
