import { describe, expect, test } from "bun:test";

import { StringFns, TypeFns } from "./typeset";
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
  describe("boolean", () => {
    test("promotion", () => {
      const promotion = TypeFns.or([["boolean", true]], [["boolean", false]]);
      expect(promotion).toEqual([["boolean", null]]);
    });
  });
});
