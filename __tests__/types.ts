import * as T from "../src/types";

describe("types", () => {
  test("numbers", () => {
    const all = T.Number;
    const one = T.Number.literal(1);
    const two = T.Number.literal(2);
    const none = one.intersect(two);
    const both = one.union(two);

    expect(all.size).toBe(-1);
    expect(one.size).toBe(1);
    expect(two.size).toBe(1);
    expect(none.size).toBe(0);
    expect(both.size).toBe(2);
  });
});
