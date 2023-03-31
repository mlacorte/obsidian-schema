import { SyntaxNode, Tree } from "@lezer/common";
import { ParserConfig } from "@lezer/lr";

import { parser } from "./parser/schema.parser";

export function parse(str: string, config?: ParserConfig): Tree {
  const parserInstance = config ? parser.configure(config) : parser;

  return parserInstance.parse(str);
}

export function hasErrors(tree: Tree) {
  let error = false;

  tree.iterate({
    enter: (ref) => {
      if (ref.type.isError) {
        error = true;
        return false;
      }
    }
  });

  return error;
}

export function children(tree: Tree): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];

  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    nodes.push(node);
  }

  return nodes;
}

export { parser };
