import { children, hasErrors, parse } from "../src/parser";

describe("parser", () => {
  test("markdown", () => {
    const childCount = (str: string) => children(parse(str)).length;

    expect(childCount("")).toBe(0);
    expect(childCount("nonempty")).toBe(1);
    expect(childCount("%schema%{}%schema%")).toBe(1);
    expect(childCount("left%schema%{}%schema%")).toBe(2);
    expect(childCount("%schema%{}%schema%right")).toBe(2);
    expect(childCount("left%schema%{}%schema%right")).toBe(3);
    expect(childCount("%schema%{}%schema%%schema%{}%schema%")).toBe(2);
  });

  test("error recovery", () => {
    let tree = parse("%schema%{}");
    expect(hasErrors(tree)).toBe(true);
    expect(tree.topNode.firstChild?.firstChild?.nextSibling?.type.isError).toBe(
      true
    );

    tree = parse("%schema%{}%schema%");
    expect(hasErrors(tree)).toBe(false);
  });

  test("tags", () => {
    const errors = (str: string) => hasErrors(parse(str, { top: "TagDoc" }));

    expect(errors("#some/tag")).toBe(false);
    expect(errors("#some/ tag")).toBe(true);
  });

  test("identifiers", () => {
    const errors = (str: string) =>
      hasErrors(parse(str, { top: "IdentifierDoc" }));

    expect(errors("")).toBe(true);
    expect(errors("plain")).toBe(false);
    expect(errors("fancy-5tuff_")).toBe(false);
    expect(errors("-invalid")).toBe(true);
    expect(errors("0-also_invalid")).toBe(true);
    expect(errors("😀-simple-emoji")).toBe(false);
    expect(errors("another-🙃-emoji")).toBe(false);
    expect(errors("👩🏻‍❤️‍💋‍👨🏽_a_complex_emoji")).toBe(false);
  });
});
