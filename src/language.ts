import { LRLanguage } from "@codemirror/language";

import { parser } from "./parser";

export const schemaLanguage = LRLanguage.define({
  parser,
  languageData: {
    closeBrackets: { brackets: ["%{", "(", "[", "{", "'", '"', "`"] },
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } }
  }
});
