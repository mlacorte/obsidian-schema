import { Tree } from "@lezer/common";

import * as schema from "./parser/schema.parser";

export function parseSchema(str: string): Tree {
  return schema.parser.configure({ strict: true, top: "Block" }).parse(str);
}

export function parseMarkdown(str: string): Tree {
  return schema.parser.parse(str);
}

export function debug(tree: Tree) {
  const res: unknown[] = [];
  const cursor = tree.cursor();

  if (!cursor.firstChild()) {
    return res;
  }

  do {
    const isError = cursor.type.isError;

    isError && cursor.firstChild();
    res.push([cursor.name, cursor.from, cursor.to, isError]);
    isError && cursor.parent();
  } while (cursor.nextSibling());

  return res;
}
