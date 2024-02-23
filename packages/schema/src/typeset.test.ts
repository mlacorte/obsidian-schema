/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, test } from "bun:test";

import * as T from "./typeset";
import * as UtilFns from "./util";

const one = T.Number(1);
const two = T.Number(2);
const three = T.Number(3);

const eq = (a: T.Type, b: T.Type): void => {
  expect(a.toString()).toBe(b.toString());
};

describe("util", () => {
  const { _cmp, _or, _and } = T.StringFns;
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
  const { error: msg } = T.NeverFns;

  describe("boolean", () => {
    test("promotion", () => {
      eq(T.True.or(T.False), T.Boolean);
    });
  });

  describe("unions", () => {
    const a = T.String("a");
    const number = T.Number;

    test("or", () => {
      eq(a.or(number), number.or(a));
    });

    test("and", () => {
      eq(a.and(number), T.Never.error(msg(a.value, number.value)));
    });
  });

  describe("any", () => {
    test("or", () => {
      eq(T.Any.or(T.String), T.Any);
    });

    test("and", () => {
      eq(T.Any.and(T.String), T.String);
    });
  });

  describe("never", () => {
    test("or", () => {
      eq(T.Never.or(T.Number), T.Number);
    });

    test("and", () => {
      eq(T.Never.and(T.Number), T.Never);
    });
  });

  describe("null", () => {
    describe("or", () => {
      test("self", () => {
        eq(T.Null.or(T.Null), T.Null);
      });
      test("other", () => {
        eq(T.Null.or(T.Number).and(T.Null), T.Null);
      });
    });

    describe("and", () => {
      test("self", () => {
        eq(T.Null.and(T.Null), T.Null);
      });
      test("other", () => {
        eq(
          T.Null.and(T.Number),
          T.Never.error(msg(T.Null.value, T.Number.value))
        );
      });
    });
  });

  describe("objects", () => {
    const a = T.Object({ a: one.or(two) }, T.Any);
    const b = T.Object({ a: one }, T.Any);
    const c = T.Object({ a: one, b: two }, T.Any);
    const d = T.Object({ a: two.or(three) }, T.Any);

    describe("identity", () => {
      test("or", () => {
        eq(a.or(a), a);
      });
      test("and", () => {
        eq(a.and(a), a);
      });
    });

    describe("subset", () => {
      test("or", () => {
        eq(a.or(c), T.Object({ a: one.or(two), b: T.Any }, T.Any));
      });
      test("and", () => {
        eq(a.and(b), b);
        eq(a.and(c), T.Object({ a: one, b: two }, T.Any));
      });
    });

    describe("intersect", () => {
      test("or", () => {
        eq(a.or(d), T.Object({ a: one.or(two).or(three) }, T.Any));
      });

      test("and", () => {
        eq(a.and(d), T.Object({ a: two }, T.Any));
      });
    });

    describe("disjoint", () => {
      test("and", () => {
        expect(b.and(d).value[0]).toEqual("never");
      });
    });
  });

  describe("lists", () => {
    const a = T.Array([one.or(two)], T.Any);
    const b = T.Array([one], T.Any);
    const c = T.Array([one, two], T.Any);
    const d = T.Array([two.or(three)], T.Any);

    describe("identity", () => {
      test("or", () => {
        eq(a.or(a), a);
      });
      test("and", () => {
        eq(a.and(a), a);
      });
    });

    describe("subset", () => {
      test("or", () => {
        eq(a.or(c), T.Array([one.or(two), T.Any], T.Any));
      });
      test("and", () => {
        eq(a.and(b), b);
        eq(a.and(c), T.Array([one, two], T.Any));
      });
    });

    describe("intersect", () => {
      test("or", () => {
        eq(a.or(d), T.Array([one.or(two).or(three)], T.Any));
      });

      test("and", () => {
        eq(a.and(d), T.Array([two], T.Any));
      });
    });

    describe("disjoint", () => {
      test("and", () => {
        expect(b.and(d).value[0]).toEqual("never");
      });
    });
  });
});
