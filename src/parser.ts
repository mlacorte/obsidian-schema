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

export function children(tree: Tree | SyntaxNode): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];

  for (
    let node = tree instanceof Tree ? tree.topNode.firstChild : tree.firstChild;
    node;
    node = node.nextSibling
  ) {
    nodes.push(node);
  }

  return nodes;
}

type ParseTreeJSON =
  | [string, string]
  | [string, ParseTreeJSON, ...ParseTreeJSON[]];

export function toJSON(str: string, tree: Tree): ParseTreeJSON {
  const toJSONRec = (node: SyntaxNode): ParseTreeJSON => {
    const childTrees = children(node).map((node) => toJSONRec(node));

    return [
      node.name,
      ...(childTrees.length === 0
        ? [str.slice(node.from, node.to)]
        : childTrees)
    ] as any;
  };

  return toJSONRec(tree.topNode);
}

export { parser };
