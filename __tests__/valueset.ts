import { fn, val } from "../src/valueset";

describe("valueset", () => {
  test("valueset", () => {
    const a = val("a", [-2, 2]);

    expect(a.u.toString()).toEqual("a");
    expect(a.R.map((p) => p.v).toArray()).toEqual([-2, 2]);
    expect(a.R.map((p) => p.l.map((s) => s.toString())).toJS()).toEqual([
      ["a[0]"],
      ["a[1]"]
    ]);

    const double = fn("double", [a, a], (l, r) => l + r);

    expect(double.u.toString()).toEqual("double");
    expect(double.R.map((p) => p.v).toArray()).toEqual([-4, 4]);
    expect(double.R.map((p) => p.l.map((s) => s.toString())).toJS()).toEqual([
      ["a[0]"],
      ["a[1]"]
    ]);
  });
});
