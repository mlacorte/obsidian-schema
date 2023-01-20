import { Number, String, Union } from "../src/types";

describe("types", () => {
  test("types", () => {
    const one = Number.literals().or(Number.literals(1));
    const two = Number.and(Number.literals(2));
    const empty = one.and(two);
    const union = one.or(two);
    const intersect = union.and(two);

    expect(Number.isType).toBe(true);
    expect(one.isValue).toBe(true);
    expect(two.isValue).toBe(true);
    expect(empty.isEmpty).toBe(true);
    expect(union.isType).toBe(true);
    expect(intersect.isValue).toBe(true);
  });

  test("unions", () => {
    const one = Number.literals(1).and(Number);
    const a = String.and(String.literals("a"));

    const union = Union.or(Number, a);
    const empty = Number.lift().and(a);
    const literal = Union.or(one, one);

    expect(union.isType).toBe(true);
    expect(empty.isEmpty).toBe(true);
    expect(literal.isValue).toBe(true);
  });
});
