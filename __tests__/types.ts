import { Number, Union } from "../src/types";

describe("types", () => {
  test("types", () => {
    const all = Number;
    const one = Number.literal(1);
    const two = Number.literal(2);
    const none = one.and(two);
    const both = one.or(two);

    expect(all.size).toBe(-1);
    expect(one.size).toBe(1);
    expect(two.size).toBe(1);
    expect(none.size).toBe(0);
    expect(both.size).toBe(2);
  });

  test("unions", () => {
    const number = Union.type("number");
    const one = Union.literal("number", 1);
    const string = Union.type("string");
    const a = Union.literal("string", "a");

    expect(number.size).toBe(1);
    expect(one.size).toBe(1);
    expect(string.size).toBe(1);
    expect(a.size).toBe(1);

    const typesOr = number.or(string);
    const typesAnd = number.and(string);
    const litsOr = one.or(a);
    const litsAnd = one.and(a);
    const allOr = typesOr.or(litsOr);
    const allAnd = typesAnd.and(litsAnd);

    expect(typesOr.size).toBe(2);
    expect(typesAnd.size).toBe(0);
    expect(litsOr.size).toBe(2);
    expect(litsAnd.size).toBe(0);
    expect(allOr.size).toBe(2);
    expect(allAnd.size).toBe(0);
  });
});
