import { IType, Number, String } from "../src/types";

describe("types", () => {
  test("types", () => {
    const one = Number.or(Number.from(1));
    const two = Number.and(Number.from(2)) as IType<"number">;
    const never = one.and(two);
    const union = one.or(two);
    const intersect = union.and(two) as IType<"number">;

    expect(Number.type).toBe(true);
    expect(one.type).toBe(false);
    expect(two.type).toBe(false);
    expect(never.kind).toBe("never");
    expect(union.kind).toBe("union");
    expect(intersect.type).toBe(false);
  });

  test("unions", () => {
    const one = Number.from(1).and(Number) as IType<"number">;
    const a = String.and(String.from("a")) as IType<"string">;

    const union = Number.or(a);
    const never = Number.and(a);
    const literal = one.or(one);

    expect(union.kind).toBe("union");
    expect(never.kind).toBe("never");
    expect(literal.type).toBe(false);
  });
});
