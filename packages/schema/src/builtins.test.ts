import { describe, expect, test } from "bun:test";

import * as T from "./types";

const one = T.Number.literal(1);
const two = T.Number.literal(2);

describe("builtins", () => {
  describe("ops", () => {
    test("disabled", () => {
      expect(one.equals(two)).toBe(false);
    });

    // test("lte", () => {
    //   expect(op.lte.eval(one, two)).toEqual(T.True);
    //   expect(op.lte.eval(one, one)).toEqual(T.True);
    //   expect(op.lte.eval(two, one)).toEqual(T.False);
    // });

    // test("gt", () => {
    //   expect(op.gt.eval(one, two)).toEqual(T.False);
    //   expect(op.gt.eval(one, one)).toEqual(T.False);
    //   expect(op.gt.eval(two, one)).toEqual(T.True);
    // });

    // test("gte", () => {
    //   expect(op.gte.eval(one, two)).toEqual(T.False);
    //   expect(op.gte.eval(one, one)).toEqual(T.True);
    //   expect(op.gte.eval(two, one)).toEqual(T.True);
    // });

    // test("eq", () => {
    //   expect(op.eq.eval(one, two)).toEqual(T.False);
    //   expect(op.eq.eval(one, one)).toEqual(T.True);
    //   expect(op.eq.eval(one, two)).toEqual(T.False);
    // });

    // test("neq", () => {
    //   expect(op.neq.eval(one, two)).toEqual(T.True);
    //   expect(op.neq.eval(one, one)).toEqual(T.False);
    //   expect(op.neq.eval(one, two)).toEqual(T.True);
    // });
  });
});
