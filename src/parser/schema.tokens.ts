import { ExternalTokenizer, InputStream } from "@lezer/lr";

import { dataDelim, schemaDelim, unknown } from "./schema.terms";

const dataDelimLit = "%data%";
const schemaDelimLit = "%schema%";

function match(input: InputStream, offset: number, pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (input.peek(i + offset) !== pattern.charCodeAt(i)) {
      return false;
    }
  }

  return true;
}

export const schemaDelimTokenizer = new ExternalTokenizer((input) => {
  if (match(input, 0, schemaDelimLit)) {
    input.acceptToken(schemaDelim, schemaDelimLit.length);
  }
});

export const dataDelimTokenizer = new ExternalTokenizer((input) => {
  if (match(input, 0, dataDelimLit)) {
    input.acceptToken(dataDelim, dataDelimLit.length);
  }
});

export const unknownTokenizer = new ExternalTokenizer((input) => {
  let curr = input.next;
  let offset = 0;

  if (curr === -1) {
    return;
  }

  while (
    curr !== -1 &&
    !match(input, offset, schemaDelimLit) &&
    !match(input, offset, dataDelimLit)
  ) {
    offset++;
    curr = input.peek(offset);
  }

  input.acceptToken(unknown, offset);
});
