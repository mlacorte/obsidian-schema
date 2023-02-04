import { Always, IAny, Never, Number, Object, String } from "../src/types";

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

  test("equality", () => {
    const one = Number.from(1);
    const two = Number.from(2);

    expect(Number.equals(Number)).toBe(true);
    expect(Number.equals(String)).toBe(false);
    expect(one.or(two).equals(two.or(one))).toBe(true);
    expect(Always.and(String).equals(String)).toBe(true);
    expect(Number.and(String).equals(Never)).toBe(true);
  });

  test("objects", () => {
    const one = Number.from(1);
    const two = Number.from(2);

    const a = Object.from({ a: one.or(two) });
    const b = Object.from({ a: one });
    const c = Object.from({ a: one, b: one });

    expect(a.or(a).toJSON()).toEqual(a.toJSON());
    expect(a.and(a).toJSON()).toEqual(a.toJSON());

    expect(a.or(b).toJSON()).toEqual(a.toJSON());
    expect(a.and(b).toJSON()).toEqual(b.toJSON());

    expect(a.or(c).kind).toBe("union");
    expect(a.and(c).toJSON()).toEqual(c.toJSON());
  });
});
