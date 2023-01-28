import { IAny, Number, String } from "../src/types";

function values(any: IAny): any[] {
  return [...any.values].sort();
}

function types(any: IAny): any[] {
  return [...any.types].sort();
}

describe("types", () => {
  test("types", () => {
    const one = Number.from(1).and(Number);
    const two = Number.and(Number.from(2));
    const never = one.and(two);
    const oneOrTwo = one.or(two);
    const justTwo = oneOrTwo.and(two);

    expect(Number.kind).toBe("number");
    expect(Number.type).toBe(true);
    expect(values(Number)).toEqual([]);

    expect(one.kind).toBe("number");
    expect(one.type).toBe(false);
    expect(values(one)).toEqual([1]);

    expect(two.kind).toBe("number");
    expect(two.type).toBe(false);
    expect(values(two)).toEqual([2]);

    expect(never.kind).toBe("never");
    expect(never.type).toBe(true);
    expect(values(never)).toEqual([]);

    expect(oneOrTwo.kind).toBe("number");
    expect(oneOrTwo.type).toBe(false);
    expect(values(oneOrTwo)).toEqual([1, 2]);

    expect(justTwo.kind).toBe("number");
    expect(justTwo.type).toBe(false);
    expect(values(justTwo)).toEqual([2]);
  });

  test("unions", () => {
    const a = String.and(String.from("a"));

    const union = Number.or(a);
    const never = Number.and(a);

    expect(a.kind).toBe("string");
    expect(a.type).toBe(false);
    expect(values(a)).toEqual(["a"]);

    expect(union.kind).toBe("union");
    expect(union.type).toBe(true);
    expect(types(union)).toEqual(["number", "string"]);
    expect(values(union)).toEqual(["a"]);

    expect(never.kind).toBe("never");
  });
});
