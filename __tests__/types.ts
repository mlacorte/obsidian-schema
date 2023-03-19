import * as T from "../src/types";

describe("types", () => {
  test("types", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const number = one.or(T.Number);
    const never = one.and(two);
    const oneOrTwo = one.or(two);

    expect(one.type).toBe("number");
    expect(one.value).toBe(1);
    expect(two.type).toBe("number");
    expect(two.value).toBe(2);
    expect(number.type).toBe("number");
    expect(number.value).toBe(T.Any);
    expect(never.type).toBe("never");
    expect((never.value as any).toJS()).toEqual([
      {
        message: "Can't combine '1' and '2'.",
        vars: []
      }
    ]);
    expect(oneOrTwo.type).toBe("union");
  });

  test("boolean", () => {
    expect(T.True.or(T.False)).toEqual(T.Boolean);
  });

  test("unions", () => {
    const a = T.String.literal("a");
    const union = T.Number.or(a);
    const never = T.Number.and(a);
    const number = union.and(T.Number);

    expect(a.type).toBe("string");
    expect(union.type).toBe("union");
    expect(never.type).toBe("never");
    expect(number.type).toBe("number");
  });

  test("any", () => {
    const any = T.String.or(T.Any);
    const string = T.String.and(T.Any);

    expect(any.type).toBe("any");
    expect(string.type).toBe("string");
  });

  test("never", () => {
    const never = T.Number.and(T.Never);
    const number = T.Number.or(T.Never);

    expect(never.type).toBe("never");
    expect(number.type).toBe("number");
  });

  test("equality", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);

    expect(T.Number.equals(T.Number)).toBe(true);
    expect(T.Number.equals(T.String)).toBe(false);
    expect(one.or(two).equals(two.or(one))).toBe(true);
    expect(T.Any.and(T.String).equals(T.String)).toBe(true);
    expect(T.Number.and(T.String).type).toBe("never");
  });

  test("objects", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const three = T.Number.literal(3);

    const a = T.Object.object({ a: one.or(two) });
    const b = T.Object.object({ a: one });
    const c = T.Object.object({ a: one, b: one });
    const d = T.Object.object({ a: two.or(three) });

    expect(a.or(a)).toEqual(a);
    expect(a.and(a)).toEqual(a);

    expect(a.or(b)).toEqual(a);
    expect(a.and(b)).toEqual(b);

    expect(a.or(c).type).toBe("union");
    expect(a.and(c)).toEqual(c);

    expect(a.or(d)).toEqual(T.Object.object({ a: one.or(two).or(three) }));
  });

  test("lists", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const three = T.Number.literal(3);

    const a = T.Array.list([one.or(two)]);
    const b = T.Array.list([one]);
    const c = T.Array.list([one, two]);
    const d = T.Array.list([two.or(three)]);

    expect(a.or(a)).toEqual(a);
    expect(a.and(a)).toEqual(a);

    expect(a.or(b)).toEqual(a);
    expect(a.and(b)).toEqual(b);

    expect(a.or(c).type).toBe("union");
    expect(a.and(c)).toEqual(c);

    expect(a.or(d)).toEqual(T.Array.list([one.or(two).or(three)]));

    const unique1 = T.Array.list([T.String, T.String]);
    const unique2 = T.Array.list([T.String, T.Null]);
    const shared1 = T.Array.list([T.String, T.Any]);

    expect(unique1.and(unique2).type).toBe(T.Never.type);
    expect(unique1.and(shared1).type).toBe(T.Array.type);
    expect(unique2.and(shared1).type).toBe(T.Array.type);
  });

  test("functions", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);

    const normal = T.choice.eval(T.True, one, two);
    const vector = T.choice.eval(T.Array.literal([T.True, T.False]), one, two);

    expect(normal).toEqual(one);
    expect(vector).toEqual(T.Array.literal([one, two]));
  });
});
