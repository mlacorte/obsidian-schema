import { StringFns, UtilFns } from "./typeset";
import { describe, expect, test } from "bun:test";

const { compare, _or, _and } = StringFns;
const { union, intersect } = UtilFns;

const as = ["a", "b", "c"];
const bs = ["b", "c", "d"];

describe("typeset", () => {
  test("intersect", () => {
    const r1: string[] = [];

    for (const val of intersect(as, bs, _and, compare)) {
      r1.push(val);
    }

    expect(r1).toEqual(["b", "c"]);

    const r2: string[] = [];

    for (const val of intersect(bs, as, _and, compare)) {
      r2.push(val);
    }

    expect(r2).toEqual(["b", "c"]);
  });
  test("union", () => {
    const r1: string[] = [];

    for (const val of union(as, bs, _or, compare)) {
      r1.push(val);
    }

    expect(r1).toEqual(["a", "b", "c", "d"]);

    const r2: string[] = [];

    for (const val of union(bs, as, _or, compare)) {
      r2.push(val);
    }

    expect(r2).toEqual(["a", "b", "c", "d"]);
  });
});
