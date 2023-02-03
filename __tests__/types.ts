import { IAny, Number, String } from "../src/types";

function values(any: IAny): any[] {
  return any.types
    .flatMap((a) => (a.isValue() ? [a.value] : []))
    .sort()
    .toArray();
}

function types(any: IAny): any[] {
  return any.types
    .flatMap((a) => (a.isType() ? [a.kind] : []))
    .sort()
    .toArray();
}

describe("types", () => {
  test("types", () => {
    const one = Number.from(1).and(Number);
    const two = Number.from(2);
    const never = one.and(two);

    expect(Number.kind).toBe("number");
    expect(types(Number)).toEqual(["number"]);
    expect(values(Number)).toEqual([]);

    expect(one.kind).toBe("number");
    expect(types(one)).toEqual([]);
    expect(values(one)).toEqual([1]);

    expect(two.kind).toBe("number");
    expect(types(two)).toEqual([]);
    expect(values(two)).toEqual([2]);

    expect(never.kind).toBe("never");
    expect(types(never)).toEqual([]);
    expect(values(never)).toEqual([]);
  });

  test("unions", () => {
    const a = String.and(String.from("a"));
    const union = Number.or(a);
    const never = Number.and(a);

    expect(a.kind).toBe("string");
    expect(types(a)).toEqual([]);
    expect(values(a)).toEqual(["a"]);

    expect(union.kind).toBe("union");
    expect(types(union)).toEqual(["number"]);
    expect(values(union)).toEqual(["a"]);

    expect(never.kind).toBe("never");
  });
});
