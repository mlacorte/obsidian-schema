import { ExternalTokenizer, InputStream } from "@lezer/lr";
import emoji from "emoji-regex";

import {
  dataDelim,
  identifier,
  schemaDelim,
  unknown
} from "./schema.terms";

const dataDelimLit = "%data%";
const schemaDelimLit = "%schema%";

const emojiRegex = new RegExp(emoji(), "");
const longestEmojiSeqLength = 24; // probably overkill, but idk
const identifierFirstRegex = /\p{Letter}/u;
const identifierLaterRegex = /[0-9\p{Letter}_-]/u;

function lookaheadMatch(input: InputStream, pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (input.peek(i) !== pattern.codePointAt(i)) {
      return false;
    }
  }

  return true;
}

function tryTake(input: InputStream, num: number): string {
  const chars: number[] = [];

  for (let off = 0; off < num; off++) {
    const char = input.peek(off);

    if (char === -1) {
      break;
    }

    chars.push(char);
  }

  return String.fromCodePoint(...chars);
}

export const schemaDelimTokenizer = new ExternalTokenizer((input) => {
  if (lookaheadMatch(input, schemaDelimLit)) {
    input.acceptToken(schemaDelim, schemaDelimLit.length);
  }
});

export const dataDelimTokenizer = new ExternalTokenizer((input) => {
  if (lookaheadMatch(input, dataDelimLit)) {
    input.acceptToken(dataDelim, dataDelimLit.length);
  }
});

export const unknownTokenizer = new ExternalTokenizer((input) => {
  if (input.next === -1) {
    return;
  }

  for (;;) {
    if (input.next === "\\".codePointAt(0)) {
      input.advance(2);
      continue;
    }

    if (
      input.next === -1 ||
      lookaheadMatch(input, schemaDelimLit) ||
      lookaheadMatch(input, dataDelimLit)
    ) {
      break;
    }

    input.advance();
  }

  input.acceptToken(unknown);
});

function identifierCharCheck(input: InputStream, regex: RegExp): number {
  if (input.next === -1) {
    return 0;
  }

  if (regex.test(String.fromCodePoint(input.next))) {
    return 1;
  }

  const str = tryTake(input, longestEmojiSeqLength);
  const emojiMatch = emojiRegex.exec(str);

  if (emojiMatch === null) {
    return 0;
  }

  emojiRegex.lastIndex = 0;
  return emojiMatch[0].length;
}

export const identifierTokenizer = new ExternalTokenizer(
  (input) => {
    let len = identifierCharCheck(input, identifierFirstRegex);

    if (len === 0) {
      return;
    }

    input.advance(len);

    for (;;) {
      len = identifierCharCheck(input, identifierLaterRegex);

      if (len === 0) {
        break;
      }

      input.advance(len);
    }

    input.acceptToken(identifier);
  },
  { fallback: true }
);
