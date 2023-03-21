import { fn } from "../src/builtins";
import * as T from "../src/types";

const one = T.Number.literal(1);
const two = T.Number.literal(2);
const three = T.Number.literal(3);

describe("types", () => {
  test("types", () => {
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
    expect(T.Number.equals(T.Number)).toBe(true);
    expect(T.Number.equals(T.String)).toBe(false);
    expect(one.or(two).equals(two.or(one))).toBe(true);
    expect(T.Any.and(T.String).equals(T.String)).toBe(true);
    expect(T.Number.and(T.String).type).toBe("never");
  });

  test("objects", () => {
    const a = T.Object.object(T.Any, { a: one.or(two) });
    const b = T.Object.object(T.Any, { a: one });
    const c = T.Object.object(T.Any, { a: one, b: one });
    const d = T.Object.object(T.Any, { a: two.or(three) });

    expect(a.or(a)).toEqual(a);
    expect(a.and(a)).toEqual(a);

    expect(a.or(b)).toEqual(a);
    expect(a.and(b)).toEqual(b);

    expect(a.or(c).type).toBe("union");
    expect(a.and(c)).toEqual(c);

    expect(a.or(d)).toEqual(
      T.Object.object(T.Any, { a: one.or(two).or(three) })
    );
  });

  test("lists", () => {
    const a = T.Array.list(T.Any, [one.or(two)]);
    const b = T.Array.list(T.Any, [one]);
    const c = T.Array.list(T.Any, [one, two]);
    const d = T.Array.list(T.Any, [two.or(three)]);

    expect(a.or(a)).toEqual(a);
    expect(a.and(a)).toEqual(a);

    expect(a.or(b)).toEqual(a);
    expect(a.and(b)).toEqual(b);

    expect(a.or(c).type).toBe("union");
    expect(a.and(c)).toEqual(c);

    expect(a.or(d)).toEqual(T.Array.list(T.Any, [one.or(two).or(three)]));

    const unique1 = T.Array.list(T.Any, [T.String, T.String]);
    const unique2 = T.Array.list(T.Any, [T.String, T.Null]);
    const shared1 = T.Array.list(T.Any, [T.String, T.Any]);

    expect(unique1.and(unique2).type).toBe(T.Never.type);
    expect(unique1.and(shared1).type).toBe(T.Array.type);
    expect(unique2.and(shared1).type).toBe(T.Array.type);
  });

  test("cmp", () => {
    const val = T.Number.literal(3.14);
    const literal = T.Array.literal([val]);
    const list = T.Array.list(T.Number);

    const a = list.or(T.Number);
    const b = T.Number.or(list);

    expect(literal.cmp(list)).toBe(T.Cmp.Subset);
    expect(literal.cmp(a)).toBe(T.Cmp.Subset);
    expect(literal.cmp(b)).toBe(T.Cmp.Subset);
  });

  describe("functions", () => {
    test("vectorize", () => {
      const lit = (arg: T.Type | T.Type[]): T.Type =>
        Array.isArray(arg) ? T.Array.literal(arg as T.Type[]) : (arg as T.Type);

      const or = (...args: (T.Type | T.Type[])[]) =>
        args.map(lit).reduce((a, b) => a.or(b), T.Never);

      const tests: [T.Type, T.Type, T.Type, T.Type][] = [
        [T.True, one, two, one],
        [[T.True, T.False], one, two, [one, two]],
        [
          T.Boolean,
          [T.String, one],
          T.Number,
          [or(T.String, T.Number), T.Number]
        ],
        [
          T.Array.list(T.Boolean),
          [T.String, one],
          T.Number,
          or([], [or(T.String, T.Number)], [or(T.String, T.Number), T.Number])
        ],
        [
          T.Array.list(T.Boolean),
          T.Array.list(T.String.or(one)),
          T.Number,
          T.Array.list(T.Number.or(T.String))
        ],
        [
          T.Array.list(T.Boolean),
          T.Array.list(T.Number, [T.String, one]),
          T.Number,
          or(
            [],
            [T.String.or(T.Number)],
            T.Array.list(T.Number, [T.String.or(T.Number), T.Number])
          )
        ],
        [
          T.Array.list(T.Boolean, [T.Boolean]),
          [T.String, one],
          [T.Number, two],
          or([or(T.String, T.Number)], [or(T.String, T.Number), or(one, two)])
        ]
      ].map((row) => row.map(lit) as any);

      for (const test of tests) {
        expect(fn.choice.eval(...(test.slice(0, 3) as any))).toEqual(test[3]);
      }
    });
  });
});
