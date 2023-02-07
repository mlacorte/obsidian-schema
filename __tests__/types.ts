import * as T from "../src/types";

function values(any: T.IAny): any[] {
  return any.types
    .flatMap((a) => (a.isValue() ? [a.value] : []))
    .sort()
    .toArray();
}

function types(any: T.IAny): any[] {
  return any.types
    .flatMap((a) => (a.isType() ? [a.kind] : []))
    .sort()
    .toArray();
}

describe("types", () => {
  test("types", () => {
    const one = T.Number.from(1);
    const two = T.Number.from(2);
    const number = one.or(T.Number);
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
    const a = T.String.from("a");
    const union = T.Number.or(a);
    const never = T.Number.and(a);
    const number = union.and(T.Number);

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

  test("any", () => {
    const any = T.String.or(T.Any);
    const string = T.String.and(T.Any);

    expect(any.kind).toBe("any");
    expect(string.kind).toBe("string");
  });

  test("never", () => {
    const never = T.Number.and(T.Never);
    const number = T.Number.or(T.Never);

    expect(never.kind).toBe("never");
    expect(number.kind).toBe("number");
  });

  test("equality", () => {
    const one = T.Number.from(1);
    const two = T.Number.from(2);

    expect(T.Number.equals(T.Number)).toBe(true);
    expect(T.Number.equals(T.String)).toBe(false);
    expect(one.or(two).equals(two.or(one))).toBe(true);
    expect(T.Any.and(T.String).equals(T.String)).toBe(true);
    expect(T.Number.and(T.String).equals(T.Never)).toBe(true);
  });

  test("objects", () => {
    const one = T.Number.from(1);
    const two = T.Number.from(2);

    const a = T.Object.from({ a: one.or(two) });
    const b = T.Object.from({ a: one });
    const c = T.Object.from({ a: one, b: one });

    expect(a.or(a).toJSON()).toEqual(a.toJSON());
    expect(a.and(a).toJSON()).toEqual(a.toJSON());

    expect(a.or(b).toJSON()).toEqual(a.toJSON());
    expect(a.and(b).toJSON()).toEqual(b.toJSON());

    expect(a.or(c).kind).toBe("union");
    expect(a.and(c).toJSON()).toEqual(c.toJSON());
  });

  test("lists", () => {
    const one = T.Number.from(1);
    const two = T.Number.from(2);

    const a = T.List.from([one.or(two)]);
    const b = T.List.from([one]);
    const c = T.List.from([one, two]);

    expect(a.or(a).toJSON()).toEqual(a.toJSON());
    expect(a.and(a).toJSON()).toEqual(a.toJSON());

    expect(a.or(b).toJSON()).toEqual(a.toJSON());
    expect(a.and(b).toJSON()).toEqual(b.toJSON());

    expect(a.or(c).kind).toBe("union");
    expect(a.and(c).toJSON()).toEqual(c.toJSON());
  });
});
