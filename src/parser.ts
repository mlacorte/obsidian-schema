import { SyntaxNode, Tree } from "@lezer/common";
import { ParserConfig } from "@lezer/lr";

import { parser } from "./parser/schema.parser";

export function parse(str: string, config?: ParserConfig): Tree {
  return parser.configure(config || {}).parse(str);
}

export function* traverse(tree: Tree) {
  const cursor = tree.cursor();

  do {
    yield cursor;
  } while (cursor.next());
}

export function hasErrors(tree: Tree) {
  for (const cursor of traverse(tree)) {
    if (cursor.type.isError) {
      return true;
    }
  }

  return false;
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

type ParseTreeJSON = [string, string] | [string, ...ParseTreeJSON[]];

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

export function prettyPrint(str: string, tree?: Tree): string {
  const strs: string[] = [];

  const printASTRec = ([name, ...values]: ParseTreeJSON, depth: number) => {
    const indent = " ".repeat(depth * 2);
    name = JSON.stringify(name);

    if (typeof values[0] === "string") {
      const value = JSON.stringify(values[0]);

      if (value.length === 0) {
        strs.push(`${indent}[${name}],`);
      } else {
        strs.push(`${indent}[${name}, ${value}],`);
      }
    } else {
      strs.push(`${indent}[${name},`);

      for (const child of values as ParseTreeJSON[]) {
        printASTRec(child, depth + 1);
      }

      strs[strs.length - 1] = strs[strs.length - 1].slice(0, -1) + "],";
    }
  };

  printASTRec(toJSON(str, tree || parse(str)), 0);

  const res = strs.join("\n").slice(0, -1);

  return res;
}

export { parser };
