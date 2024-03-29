/* eslint-disable no-unreachable-loop */
/* eslint-disable no-labels */
import { type Text } from "@codemirror/state";
import { type Tree, type TreeCursor } from "@lezer/common";
import {
  $any,
  $boolean,
  $never,
  $number,
  type IExprCtx,
  type IObjectCtx,
  type TypeRef
} from "schema";

import {
  _protected,
  Arg,
  Bool,
  Identifier,
  Include,
  Lambda,
  Link,
  LocalProperty,
  Not,
  Number as _Number,
  Of,
  override,
  Property,
  PropertyIdentifier,
  Tag,
  TypedArg
} from "./parser/schema.parser.terms";

const evalExpr = (text: Text, cursor: TreeCursor, c: IExprCtx): TypeRef => {
  console.log("evalExpr:", text.sliceString(cursor.from, cursor.to));
  switch (cursor.type.id) {
    case Not:
      cursor.next(); // => "!"
      cursor.next(); // => expression
      return c.not(evalExpr(text, cursor, c));
    case Identifier:
      return c.get(text.sliceString(cursor.from, cursor.to));
    case Bool:
      return $boolean(/^true$/i.test(text.sliceString(cursor.from, cursor.to)));
    case _Number:
      return $number(Number(text.sliceString(cursor.from, cursor.to)));
    case Lambda: {
      cursor.next(); // => "("
      cursor.next(); // => LambdaArgs
      const args: Array<[string, TypeRef]> = [];

      args: while (true) {
        cursor.next(); // => Arg or TypedArg or "=>"

        switch (cursor.type.id as unknown) {
          case Arg:
            cursor.next(); // => Identifier;
            args.push([text.sliceString(cursor.from, cursor.to), $any]);
            cursor.next(); // => "," or ")";
            break;
          case TypedArg: {
            cursor.next(); // => Identifier
            const arg = text.sliceString(cursor.from, cursor.to);
            cursor.next(); // => ":"
            cursor.next(); // => expression
            args.push([arg, evalExpr(text, cursor, c)]);
            cursor.next(); // => "," or ")"
            break;
          }
          default:
            break args;
        }
      }

      cursor.next(); // => LambdaExpr
      cursor.next(); // => expression
      return c.fn(args, (c) => evalExpr(text, cursor, c));
    }
    default:
      return $never(`UNKNOWN: ${cursor.name}`);
  }
};

// TODO: add Link and Tag types + protection logic
const readProp = (text: Text, cursor: TreeCursor): string => {
  // console.log("readProp:", text.sliceString(cursor.from, cursor.to));
  if (cursor.type.id === _protected) {
    cursor.next();
  }

  switch (cursor.type.id) {
    case PropertyIdentifier:
    case Tag:
    case Link:
      return text.sliceString(cursor.from, cursor.to);
  }

  return JSON.parse(text.sliceString(cursor.from, cursor.to));
};

const evalObj = (text: Text, cursor: TreeCursor, c: IObjectCtx): void => {
  console.log("evalObj:");
  obj: do {
    console.log("...", text.sliceString(cursor.from, cursor.to))
    switch (cursor.type.id as unknown) {
      case Of: {
        cursor.next(); // => "of"
        cursor.next(); // => expression
        const lazyCursor = cursor.node.cursor();
        c.of((c) => evalExpr(text, lazyCursor, c));
        break;
      }
      case Include: {
        cursor.next(); // => "include"
        cursor.next(); // => expression
        const lazyCursor = cursor.node.cursor();
        c.include((c) => evalExpr(text, lazyCursor, c));
        break;
      }
      case LocalProperty: {
        cursor.next(); // => "local"
        cursor.next(); // => propertyKey
        const name = readProp(text, cursor);
        cursor.next(); // => ":"
        cursor.next(); // => expression
        const lazyCursor = cursor.node.cursor();
        c.local(name, (c) => evalExpr(text, lazyCursor, c));
        break;
      }
      case Property: {
        cursor.next(); // => "override" or propertyKey
        // TODO: add override logic
        if (cursor.type.id === override) cursor.next();
        const name = readProp(text, cursor);
        cursor.next(); // => ":"
        cursor.next(); // => expression;
        const lazyCursor = cursor.node.cursor();
        c.set(name, (c) => evalExpr(text, lazyCursor, c));
        break;
      }
      default:
        console.error("UNKNOWN:", cursor.name);
        break obj;
    }

    cursor.next(false);
  } while (cursor.nextSibling());
};

export const treeEval =
  (doc: Text, tree: Tree) =>
  (c: IObjectCtx): void => {
    const cursor = tree.cursor();
    cursor.firstChild();
    evalObj(doc, cursor, c);
  };
