import { $array, $number, $object, $string, ops } from "../src";
import { Context } from "../src/context";

const input = new Context().eval((c) => {
  c.local("cmp", (c) =>
    c.fn(["a", "b"], (c) => c.call(c.get("error"), [$string("NEVER")]))
  );

  c.local("cmp", (c) =>
    c.fn(["a", "b"], (c) => c.call(ops.lt, [c.get("a"), c.get("b")]))
  );

  c.set("foo", (c) =>
    c.obj((c) => {
      c.set("a", () => $number(10));
      c.set("bar", (c) => c.get("this", [$string("bar"), $string("foo")]));
    })
  );

  c.set("bar", (c) =>
    c.obj((c) => {
      c.set("foo", (c) => c.get("this", [$string("foo"), $string("a")]));
    })
  );

  c.set("other", (c) => {
    c.local("a", () => $number(10));
    c.local("b", () => $number(10));

    return c.arr((c) => {
      c.set((c) => c.get("a"));
      c.set((c) => c.get("b"));
      c.set((c) => c.call(ops.plus, [c.get("a"), c.get("b")]));
    });
  });

  c.set("test", (c) => {
    c.local("a", () => $number(10));

    return c.get("a");
  });

  c.set("a", () => $number(20));

  c.set("b", (c) => c.or($number(10), $number(30)));

  c.set("c", (c) =>
    c.call(c.get("choice"), [
      c.call(c.get("cmp"), [
        c.get("this", [$string("a")]),
        c.get("this", [$string("b")])
      ]),
      c.call(ops.plus, [c.get("this", [$string("a")]), $number(3)]),
      c.call(ops.plus, [c.get("this", [$string("b")]), $number(5)])
    ])
  );

  c.set("c", () => $number(23));
});

const output = $object({
  foo: $object({
    a: $number(10),
    bar: $number(10)
  }),
  bar: $object({
    foo: $number(10)
  }),
  a: $number(20),
  b: $number(10).or($number(30)),
  c: $number(23),
  other: $array([$number(10), $number(10), $number(20)]),
  test: $number(10)
});

describe("context", () => {
  test("test", () => {
    expect(input.toString()).toBe(output.toString());
  });
});
