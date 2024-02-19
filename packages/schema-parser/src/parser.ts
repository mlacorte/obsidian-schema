import { type SyntaxNode, Tree, type TreeCursor } from "@lezer/common";
import { type ParserConfig } from "@lezer/lr";

import { parser } from "./parser/schema.parser";

export function isSyntax(str: string): boolean {
  return /[A-Z⚠]/.test(str[0]);
}

export function parse(str: string, config: ParserConfig = {}): Tree {
  return parser.configure(config).parse(str);
}

export function* traverse(
  tree: Tree,
  syntax = false
): Generator<TreeCursor, void, unknown> {
  const cursor = tree.cursor();

  do {
    if (syntax || isSyntax(cursor.name)) {
      yield cursor;
    }
  } while (cursor.next());
}

export function hasErrors(tree: string | Tree): boolean {
  for (const cursor of traverse(tree instanceof Tree ? tree : parse(tree))) {
    if (cursor.type.isError) {
      return true;
    }
  }

  return false;
}

export function children(
  tree: Tree | SyntaxNode,
  syntax = false
): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];

  for (
    let node = tree instanceof Tree ? tree.topNode.firstChild : tree.firstChild;
    node !== null;
    node = node.nextSibling
  ) {
    if (syntax || isSyntax(node.name)) {
      nodes.push(node);
    }
  }

  return nodes;
}

type ParseTreeJSON = [string, string] | [string, ...ParseTreeJSON[]];

export function toJSON(
  str: string,
  args: { tree?: Tree; syntax?: boolean } = {}
): ParseTreeJSON {
  const tree = args.tree ?? parse(str);
  const syntax = args.syntax ?? false;

  const toJSONRec = (node: SyntaxNode): ParseTreeJSON => {
    const childTrees = children(node, syntax).map((node) => toJSONRec(node));

    return [
      node.name,
      ...(childTrees.length === 0
        ? [str.slice(node.from, node.to)]
        : childTrees)
    ] as any;
  };

  return toJSONRec(tree.topNode);
}

export function prettyPrint(
  str: string,
  args: { tree?: Tree; syntax?: boolean } = {}
): string {
  const strs: string[] = [];

  const prettyPrintRec = (
    [name, ...values]: ParseTreeJSON,
    depth: number
  ): void => {
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
        prettyPrintRec(child, depth + 1);
      }

      strs[strs.length - 1] = strs[strs.length - 1].slice(0, -1) + "],";
    }
  };

  prettyPrintRec(toJSON(str, args), 0);

  const res = strs.join("\n").slice(0, -1);

  return res;
}

export { parser };
