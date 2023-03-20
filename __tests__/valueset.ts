import * as T from "../src/types";
import { fn, val } from "../src/valueset";

const one = T.Number.literal(1);
const two = T.Number.literal(2);
const three = T.Number.literal(3);
const four = T.Number.literal(4);
const five = T.Number.literal(5);
const six = T.Number.literal(6);

describe("valueset", () => {
  test("valueset", () => {
    const empty = fn("empty", [], () => one);

    expect(empty.values()).toEqual([one]);
    expect(empty.conditions()).toEqual([[]]);

    const a = val("a", [one, two]);

    expect(a.values()).toEqual([one, two]);
    expect(a.conditions()).toEqual([[[a.id, one]], [[a.id, two]]]);

    const b = val("b", [one, two]);

    expect(b.values()).toEqual([one, two]);
    expect(b.conditions()).toEqual([[[b.id, one]], [[b.id, two]]]);

    const c = fn("c", [a, b], (a, b) =>
      T.Number.literal((a.value as any) + b.value)
    );

    expect(c.values()).toEqual([two, three, three, four]);
    expect(c.conditions()).toEqual([
      [
        [a.id, one],
        [b.id, one]
      ],
      [
        [a.id, one],
        [b.id, two]
      ],
      [
        [a.id, two],
        [b.id, one]
      ],
      [
        [a.id, two],
        [b.id, two]
      ]
    ]);

    const d = fn("d", [a, a], (l, r) =>
      T.Number.literal((l.value as any) + r.value)
    );

    expect(d.values()).toEqual([two, four]);
    expect(d.conditions()).toEqual([[[a.id, one]], [[a.id, two]]]);

    const e = fn("e", [a, c], (a, c) =>
      T.Number.literal((c.value as any) + a.value)
    );

    expect(e.values()).toEqual([three, four, five, six]);
    expect(e.conditions()).toEqual([
      [
        [a.id, one],
        [b.id, one],
        [c.id, two]
      ],
      [
        [a.id, one],
        [b.id, two],
        [c.id, three]
      ],
      [
        [a.id, two],
        [b.id, one],
        [c.id, three]
      ],
      [
        [a.id, two],
        [b.id, two],
        [c.id, four]
      ]
    ]);
  });
});
