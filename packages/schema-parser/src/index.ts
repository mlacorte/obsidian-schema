import { completeFromList } from "@codemirror/autocomplete";
import {
  foldInside,
  foldNodeProp,
  LanguageSupport,
  LRLanguage,
  syntaxTree
} from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { type Extension } from "@codemirror/state";

import { highlight } from "./parser/schema.highlight";
import { parser } from "./parser/schema.parser";
import * as terms from "./parser/schema.parser.terms";
import * as util from "./util";

export const schemaUtil = util;

export const schemaTerms = terms;

export const schemaParser = parser;

export const schemaHighlight = highlight;

export const schemaParserWithMetadata = parser.configure({
  props: [
    schemaHighlight,
    foldNodeProp.add({
      Object: foldInside
    })
  ]
});

export const schemaLanguage = LRLanguage.define({
  parser: schemaParserWithMetadata.configure({ top: "SchemaDoc" }),
  languageData: {
    commentTokens: {
      line: "//",
      block: { open: "/*", close: "*/" }
    }
  }
});

export const schemaCompletion: Extension = schemaLanguage.data.of({
  autocomplete: completeFromList([
    { label: "override", type: "keyword" },
    { label: "protected", type: "keyword" },
    { label: "and", type: "keyword" },
    { label: "or", type: "keyword" },
    { label: "of", type: "keyword" },
    { label: "include", type: "keyword" },
    { label: "local", type: "keyword" },
    { label: "this", type: "keyword" }
  ])
});

export const schemaLinter = linter(
  (view) => {
    const { state } = view;
    const tree = syntaxTree(state);
    const n = tree.cursor();

    do {
      if (!n.type.isError) continue;

      return [
        {
          from: n.node.prevSibling !== null ? n.node.prevSibling.to : n.from,
          to: n.node.prevSibling !== null ? n.node.prevSibling.to : n.from,
          severity: "error",
          message: "syntax error"
        }
      ];
    } while (n.next());

    return [];
  },
  {
    delay: 0
  }
);

export const schema = (): LanguageSupport =>
  new LanguageSupport(schemaLanguage, [schemaCompletion, schemaLinter]);
