import { debug, parseMarkdown } from "../src/parser";

function info(parseStr: string) {
  return debug(parseMarkdown(parseStr));
}

describe("parser", () => {
  test("schema blocks should parse the correct values", () => {
    expect(info("").length).toBe(0);
    expect(info("nonempty").length).toBe(1);
    expect(info("%schema%{}%schema%").length).toBe(1);
    expect(info("left%schema%{}%schema%").length).toBe(2);
    expect(info("%schema%{}%schema%right").length).toBe(2);
    expect(info("left%schema%{}%schema%right").length).toBe(3);
    expect(info("%schema%{}%schema%%schema%{}%schema%").length).toBe(2);
  });
});
