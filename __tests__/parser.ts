import { children, hasErrors, parse, toJSON } from "../src/parser";

describe("parser", () => {
  test("markdown", () => {
    const childCount = (str: string) => children(parse(str)).length;

    expect(childCount("")).toBe(0);
    expect(childCount("nonempty")).toBe(1);
    expect(childCount("%schema%%schema%")).toBe(1);
    expect(childCount("left%schema%%schema%")).toBe(2);
    expect(childCount("%schema%%schema%right")).toBe(2);
    expect(childCount("left%schema%%schema%right")).toBe(3);
    expect(childCount("%schema%%schema%%schema%%schema%")).toBe(2);
  });

  test("error recovery", () => {
    let tree = parse("%schema%foo: null");
    expect(hasErrors(tree)).toBe(true);
    expect(tree.topNode.firstChild?.nextSibling?.type.isError).toBe(true);

    tree = parse("%schema%%schema%");
    expect(hasErrors(tree)).toBe(false);
  });

  test("tags", () => {
    const errors = (str: string) =>
      hasErrors(parse(`"%schema%tag:${str}%schema%`));

    expect(errors("#some/tag")).toBe(false);
    expect(errors("#some/ tag")).toBe(true);
  });

  test("identifiers", () => {
    const errors = (str: string) =>
      hasErrors(parse(`%schema%${str}:true%schema%`));

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
    let errors = (str: string) =>
      hasErrors(parse(`%schema%link:${str}%schema%`));

    expect(errors("[[]]")).toBe(false);
    expect(errors("[[Some/Link]]")).toBe(false);

    errors = (str: string) => hasErrors(parse(`%schema%elink:${str}%schema%`));

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

  test("composite", () => {
    const str = `
      This is some markdown outside of the schema block.

      Check it out, you can escape it too: \\%schema%

      %schema%
        identifier: my1-2tricky-identifier,
        parens: ((("nice"))),
        empty: () => "empty",
        single: (foo) => null,
        lambda: (a,b) => 4,
        "My key": null,
        #tag: [-1, 2, 3.0],
        #nested/tag: [-1.0, -2, 3],
        [[Link|foo]]: false
      %schema%

      Math time:

      %schema%
        fancy: 10 + (3 / 10) + 29 >= 53 - 20 / 10 or (true and false)
      %schema%

      You can escape the escape sequence too to make it work though:

      \\\\%data%
        "Does this work?": True,
        😎_l33t: { a: 10, b: 20 }
      %data%

      Nice!\\`;

    expect(hasErrors(parse(str))).toBe(false);
  });
});
