import * as T from "../src/types";

describe("types", () => {
  test("types", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const number = one.or(T.Number);
    const error = one.and(two);
    const oneOrTwo = one.or(two);

    expect(one.type).toBe("number");
    expect(one.value).toBe(1);
    expect(two.type).toBe("number");
    expect(two.value).toBe(2);
    expect(number.type).toBe("number");
    expect(number.value).toBe(T.Any);
    expect(error.type).toBe("error");
    expect((error.value as any).toJS()).toEqual([
      {
        message: "Can't combine '1' and '2'.",
        vars: []
      }
    ]);
    expect(oneOrTwo.type).toBe("union");
  });

  test("unions", () => {
    const a = T.String.literal("a");
    const union = T.Number.or(a);
    const error = T.Number.and(a);
    const number = union.and(T.Number);

    expect(a.type).toBe("string");
    expect(union.type).toBe("union");
    expect(error.type).toBe("error");
    expect(number.type).toBe("number");
  });

  test("any", () => {
    const any = T.String.or(T.Any);
    const string = T.String.and(T.Any);

    expect(any.type).toBe("any");
    expect(string.type).toBe("string");
  });

  test("error", () => {
    const error = T.Number.and(T.Error);
    const number = T.Number.or(T.Error);

    expect(error.type).toBe("error");
    expect(number.type).toBe("number");
  });

  test("equality", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);

    expect(T.Number.equals(T.Number)).toBe(true);
    expect(T.Number.equals(T.String)).toBe(false);
    expect(one.or(two).equals(two.or(one))).toBe(true);
    expect(T.Any.and(T.String).equals(T.String)).toBe(true);
    expect(T.Number.and(T.String).type).toBe("error");
  });

  test("objects", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const three = T.Number.literal(3);

    const a = T.Object.record({ a: one.or(two) });
    const b = T.Object.record({ a: one });
    const c = T.Object.record({ a: one, b: one });
    const d = T.Object.record({ a: two.or(three) });

    expect(a.or(a).toJSON()).toEqual(a.toJSON());
    expect(a.and(a).toJSON()).toEqual(a.toJSON());

    expect(a.or(b).toJSON()).toEqual(a.toJSON());
    expect(a.and(b).toJSON()).toEqual(b.toJSON());

    expect(a.or(c).type).toBe("union");
    expect(a.and(c).toJSON()).toEqual(c.toJSON());

    expect(a.or(d).toJSON()).toEqual(
      T.Object.record({ a: one.or(two).or(three) }).toJSON()
    );
  });

  test("lists", () => {
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const three = T.Number.literal(3);

    const a = T.List.tuple([one.or(two)]);
    const b = T.List.tuple([one]);
    const c = T.List.tuple([one, two]);
    const d = T.List.tuple([two.or(three)]);

    expect(a.or(a).toJSON()).toEqual(a.toJSON());
    expect(a.and(a).toJSON()).toEqual(a.toJSON());

    expect(a.or(b).toJSON()).toEqual(a.toJSON());
    expect(a.and(b).toJSON()).toEqual(b.toJSON());

    expect(a.or(c).type).toBe("union");
    expect(a.and(c).toJSON()).toEqual(c.toJSON());

    expect(a.or(d).toJSON()).toEqual(
      T.List.tuple([one.or(two).or(three)]).toJSON()
    );
  });
});
