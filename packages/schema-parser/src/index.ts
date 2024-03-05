import { completeFromList } from "@codemirror/autocomplete";
import {
  foldInside,
  foldNodeProp,
  LanguageSupport,
  LRLanguage,
  syntaxTree
} from "@codemirror/language";
import { type Diagnostic, linter } from "@codemirror/lint";
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

export const schemaLinter = linter((view) => {
  const { state } = view;
  const tree = syntaxTree(state);
  const res: Diagnostic[] = [];

  tree.iterate({
    enter: (n) => {
      if (!n.type.isError) {
        return true;
      }

      const node = n.node;

      res.push({
        from: node.prevSibling !== null ? node.prevSibling.to : n.from,
        to: node.prevSibling !== null ? node.prevSibling.to : n.from,
        severity: "error",
        message: "syntax error"
      });
    }
  });

  return res;
});

export const schema = (): LanguageSupport =>
  new LanguageSupport(schemaLanguage, [schemaCompletion, schemaLinter]);
