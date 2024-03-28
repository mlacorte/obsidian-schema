/* eslint-disable no-unreachable-loop */
/* eslint-disable no-labels */
import { type Text } from "@codemirror/state";
import { type Tree, type TreeCursor } from "@lezer/common";
import {
  $any,
  $never,
  type IExprCtx,
  type IObjectCtx,
  type TypeRef
} from "schema";

import {
  Arg,
  Include,
  Lambda,
  LocalProperty,
  Of,
  Property,
  TypedArg
} from "./parser/schema.parser.terms";

const evalExpr = (text: Text, cursor: TreeCursor, c: IExprCtx): TypeRef => {
  const results = [] as unknown as [TypeRef, ...TypeRef[]];

  expr: while (true) {
    switch (cursor.type.id) {
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
        results.push(c.fn(args, (c) => evalExpr(text, cursor, c)));
        break expr;
      }
      default:
        results.push($never(`UNKNOWN: ${cursor.name}`));
        break expr;
    }
  }

  return c.or(...results);
};

const evalObj = (text: Text, cursor: TreeCursor, c: IObjectCtx): void => {
  obj: do {
    switch (cursor.type.id) {
      case Of:
        break obj;
      case Include:
        break obj;
      case LocalProperty: {
        cursor.next(); // => "local"
        cursor.next(); // => identifier
        const name = text.sliceString(cursor.from, cursor.to);
        cursor.next(); // => ":"
        cursor.next(); // => expression
        c.set(name, (c) => evalExpr(text, cursor, c));
        break obj;
      }
      case Property:
        break obj;
      default:
        console.error("UNKNOWN:", cursor.name);
        break obj;
    }
  } while (cursor.next());
};

export const treeEval =
  (doc: Text, tree: Tree) =>
  (c: IObjectCtx): void => {
    const cursor = tree.cursor();
    cursor.firstChild();
    evalObj(doc, cursor, c);
  };
