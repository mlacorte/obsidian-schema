/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, test } from "bun:test";

import { type IType, NeverFns, StringFns, TypeFns } from "./typeset";
import * as UtilFns from "./util";

describe("util", () => {
  const { _compare, _or, _and } = StringFns;
  const { and, or } = UtilFns;

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
});

describe("typeset", () => {
  const { and, or } = TypeFns;
  const { error } = NeverFns;

  describe("boolean", () => {
    test("promotion", () => {
      const promotion = or([["boolean", true]], [["boolean", false]]);
      expect(promotion).toEqual([["boolean", null]]);
    });
  });

  describe("unions", () => {
    const strVal: IType = [["string", "a"]];
    const numType: IType = [["number", null]];

    test("or", () => {
      expect(or(strVal, numType)).toEqual([...numType, ...strVal]);
    });

    test("and", () => {
      expect(and(strVal, numType)).toEqual(error(strVal, numType));
    });
  });

  describe("any", () => {
    const any: IType = ["any"];
    const string: IType = [["string", null]];

    test("or", () => {
      expect(or(any, string)).toEqual(["any"]);
    });

    test("and", () => {
      expect(and(any, string)).toEqual([["string", null]]);
    });
  });

  describe("never", () => {
    const never: IType = ["never"];
    const number: IType = [["number", 1]];

    test("or", () => {
      expect(or(never, number)).toEqual([["number", 1]]);
    });

    test("and", () => {
      expect(and(never, number)).toEqual(["never"]);
    });
  });

  describe("null", () => {
    const $null: IType = [["null", null]];
    const num: IType = [["number", null]];

    describe("or", () => {
      test("self", () => {
        expect(or($null, $null)).toEqual($null);
      });
      test("other", () => {
        expect(or($null, num)).toEqual([...$null, ...num]);
      });
    });

    describe("and", () => {
      test("self", () => {
        expect(and($null, $null)).toEqual($null);
      });
      test("other", () => {
        expect(and($null, num)).toEqual(error($null, num));
      });
    });
  });
});
