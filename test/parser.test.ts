import { Note } from "../src/parser";

describe("parser", () => {
  test("schema blocks should parse the correct values", () => {
    expect(Note.tryParse("").length).toBe(1);
    expect(Note.tryParse("nonempty").length).toBe(1);
    expect(Note.tryParse("%schema%partial").length).toBe(1);
    expect(Note.tryParse("%schema%block%schema%").length).toBe(1);
    expect(Note.tryParse("left%schema%block%schema%").length).toBe(2);
    expect(Note.tryParse("%schema%block%schema%right").length).toBe(2);
    expect(Note.tryParse("left%schema%block%schema%right").length).toBe(3);
    expect(
      Note.tryParse("%schema%block%schema%%schema%block%schema%").length
    ).toBe(2);
  });
});
