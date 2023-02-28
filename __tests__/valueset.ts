import { fn, val } from "../src/valueset";

describe("valueset", () => {
  test("valueset", () => {
    const empty = fn("empty", [], () => 10);

    expect(empty.values()).toEqual([10]);
    expect(empty.conditions()).toEqual([[]]);

    const a = val("a", [1, 2]);

    expect(a.values()).toEqual([1, 2]);
    expect(a.conditions()).toEqual([[[a.id, 1]], [[a.id, 2]]]);

    const b = val("b", [1, 2]);

    expect(b.values()).toEqual([1, 2]);
    expect(b.conditions()).toEqual([[[b.id, 1]], [[b.id, 2]]]);

    const c = fn("c", [a, b], (a, b) => a + b);

    expect(c.values()).toEqual([2, 3, 3, 4]);
    expect(c.conditions()).toEqual([
      [
        [a.id, 1],
        [b.id, 1]
      ],
      [
        [a.id, 1],
        [b.id, 2]
      ],
      [
        [a.id, 2],
        [b.id, 1]
      ],
      [
        [a.id, 2],
        [b.id, 2]
      ]
    ]);

    const d = fn("d", [a, a], (l, r) => l + r);

    expect(d.values()).toEqual([2, 4]);
    expect(d.conditions()).toEqual([[[a.id, 1]], [[a.id, 2]]]);

    const e = fn("e", [a, c], (a, c) => c + a);

    expect(e.values()).toEqual([3, 4, 5, 6]);
    expect(e.conditions()).toEqual([
      [
        [a.id, 1],
        [b.id, 1],
        [c.id, 2]
      ],
      [
        [a.id, 1],
        [b.id, 2],
        [c.id, 3]
      ],
      [
        [a.id, 2],
        [b.id, 1],
        [c.id, 3]
      ],
      [
        [a.id, 2],
        [b.id, 2],
        [c.id, 4]
      ]
    ]);
  });
});
