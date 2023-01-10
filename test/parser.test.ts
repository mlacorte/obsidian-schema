import { Schema } from "../src/parser";

describe("parser", () => {
  test("schema blocks should parse the correct values", () => {
    expect(Schema.tryParse("").length).toBe(1);
    expect(Schema.tryParse("nonempty").length).toBe(1);
    expect(Schema.tryParse("%schema%partial").length).toBe(1);
    expect(Schema.tryParse("left%schema%block%schema%").length).toBe(2);
    expect(Schema.tryParse("%schema%block%schema%right").length).toBe(2);
    expect(Schema.tryParse("left%schema%block%schema%right").length).toBe(3);
    expect(
      Schema.tryParse("%schema%block%schema%%schema%block%schema%").length
    ).toBe(2);
  });
});
