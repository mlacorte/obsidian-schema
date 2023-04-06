import { children, hasErrors, parse, prettyPrint, toJSON } from "../src/parser";

describe("parser", () => {
  test("markdown", () => {
    const childCount = (str: string) => children(parse(str)).length;

    expect(childCount("")).toBe(0);
    expect(childCount("nonempty")).toBe(1);
    expect(childCount("%{}")).toBe(1);
    expect(childCount("left%{}")).toBe(2);
    expect(childCount("%{}right")).toBe(2);
    expect(childCount("left%{}right")).toBe(3);
    expect(childCount("%{}%{}")).toBe(2);
  });

  test("error recovery", () => {
    let tree = parse("%{foo: null");
    expect(hasErrors(tree)).toBe(true);
    expect(tree.topNode.firstChild?.nextSibling?.type.isError).toBe(true);

    tree = parse("%{}");
    expect(hasErrors(tree)).toBe(false);
  });

  test("tags", () => {
    const errors = (str: string) => hasErrors(parse(`"%{tag:${str}}`));

    expect(errors("#some/tag")).toBe(false);
    expect(errors("#some/ tag")).toBe(true);
  });

  test("dates", () => {
    const tree = parse(`%{today:date(today)}`);
    expect(hasErrors(tree)).toBe(false);
  });

  test("identifiers", () => {
    const errors = (str: string) => hasErrors(parse(`%{${str}:true}`));

    expect(errors("")).toBe(true);
    expect(errors("plain")).toBe(false);
    expect(errors("fancy-5tuff_")).toBe(false);
    expect(errors("-invalid")).toBe(true);
    expect(errors("0-also_invalid")).toBe(true);
    expect(errors("😀-simple-emoji")).toBe(false);
    expect(errors("another-🙃-emoji")).toBe(false);
    expect(errors("👩🏻‍❤️‍💋‍👨🏽_a_complex_emoji")).toBe(false);
  });

  test("links", () => {
    let errors = (str: string) => hasErrors(parse(`%{link:${str}}`));

    expect(errors("[[]]")).toBe(false);
    expect(errors("[[Some/Link]]")).toBe(false);

    errors = (str: string) => hasErrors(parse(`%{elink:${str}}`));

    expect(errors("![[]]")).toBe(false);
    expect(errors("![[Some/Link]]")).toBe(false);
  });

  test("identifier expression", () => {
    const expr = "exp1-exp2";
    const str = `key:${expr}`;
    const tree = parse(str, { top: "SchemaDoc" });

    expect(hasErrors(tree)).toBe(false);
    expect(children(tree).length).toBe(1);
    expect(toJSON(str, tree)).toEqual([
      "SchemaDoc",
      ["Property", ["Identifier", "key"], ["Identifier", expr]]
    ]);
  });

  test("local property", () => {
    const str = `%{local foo: "bar", biz: foo}`;
    const tree = parse(str);

    expect(hasErrors(tree)).toBe(false);
  });

  test("composite", () => {
    const str = `
      This is some markdown outside of the schema block.

      Check it out, you can escape it too: \\%{

      %{schema: {
        identifier: my1-2tricky-identifier,
        parens: ((("nice"))),
        empty: () => "empty",
        single: (foo) => null,
        lambda: (a,b,) => 4,
        typedLambda: (a: 10, b: 20) => 30,
        "My key": null,
        #tag: [-1, 2, 3.0,],
        #nested/tag: [-1.0, -2, 3],
        [[Link|foo]]: false
      }}

      Math time:

      %{schema: {
        fancy: 10 + (3 / 10) + 29 >= 53 - 20 / 10 or (true and !false),
        a-little-more: date(now) + dur(1h4m5s),
        one-sec: dur(-1.1h) + dur(1.1h, 1s),
        expr: !(1 > 3),
      }}

      You can escape the escape sequence too to make it work though:

      \\\\%{
        "Does this work?": True,
        😎_l33t: { a: 10, b: 20, },
        today: date(today),
        now: date( now ),
        new-millenia: date(2000-01),
        freedom: date(1776-07-02),
        epoch: date(1970-01-01T00:00:00.000)
      }

      Alright, let's get fancy with postfix stuff

      %{
        dots: a.b.c.d,
        indexes: a[b["c"]]["d"],
        fns: a(b(c))(d),
        emptyFn: foo(),
        multiArgFn: foo(a,b,d),
        trailingComma: foo(a,),
      }

      Time for some keywords:

      %{
        normal: "this is normal",
        expression: local foo: "this is local", foo,
        local property: "this is local",
        withProperty: property,
        inLambda: (a) => (b) => local c: a + b, c * c,
        of foo,
        foo: [1, 2, 3, of number],
        bar: { of string },
        baz: object(of boolean),
        protected #some/tag: true,
        override pi: 3.14,
        override protected #a/little/wird: "meh"
      }

      Nice!\\`;

    const tree = parse(str);
    const errors = hasErrors(tree);

    if (errors) {
      console.log(prettyPrint(str, tree));
    }

    expect(errors).toBe(false);
  });
});
