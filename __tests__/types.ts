import { Always, IAny, Never, Number, String } from "../src/types";

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
    const one = Number.from(1);
    const two = Number.from(2);
    const number = one.or(Number);
    const never = one.and(two);
    const oneOrTwo = one.or(two);

    expect(one.kind).toBe("number");
    expect(types(one)).toEqual([]);
    expect(values(one)).toEqual([1]);

    expect(two.kind).toBe("number");
    expect(types(two)).toEqual([]);
    expect(values(two)).toEqual([2]);

    expect(number.kind).toBe("number");
    expect(types(number)).toEqual(["number"]);
    expect(values(number)).toEqual([]);

    expect(never.kind).toBe("never");
    expect(types(never)).toEqual([]);
    expect(values(never)).toEqual([]);

    expect(oneOrTwo.kind).toBe("union");
    expect(types(oneOrTwo)).toEqual([]);
    expect(values(oneOrTwo)).toEqual([1, 2]);
  });

  test("unions", () => {
    const a = String.from("a");
    const union = Number.or(a);
    const never = Number.and(a);
    const number = union.and(Number);

    expect(a.kind).toBe("string");
    expect(types(a)).toEqual([]);
    expect(values(a)).toEqual(["a"]);

    expect(union.kind).toBe("union");
    expect(types(union)).toEqual(["number"]);
    expect(values(union)).toEqual(["a"]);

    expect(never.kind).toBe("never");
    expect(types(never)).toEqual([]);
    expect(values(never)).toEqual([]);

    expect(number.kind).toBe("number");
    expect(types(number)).toEqual(["number"]);
    expect(values(number)).toEqual([]);
  });

  test("always", () => {
    const always = String.or(Always);
    const string = String.and(Always);

    expect(always.kind).toBe("always");
    expect(string.kind).toBe("string");
  });

  test("never", () => {
    const never = Number.and(Never);
    const number = Number.or(Never);

    expect(never.kind).toBe("never");
    expect(number.kind).toBe("number");
  });
});
