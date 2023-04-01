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

type ParseTree = [name: string, value: string | ParseTree[]];

export function inspect(str: string, tree: Tree): ParseTree {
  const inspectRec = (node: SyntaxNode): ParseTree => {
    const childTrees = children(node).map((node) => inspectRec(node));

    return [
      node.name,
      childTrees.length === 0 ? str.slice(node.from, node.to) : childTrees
    ];
  };

  return inspectRec(tree.topNode);
}

export { parser };
