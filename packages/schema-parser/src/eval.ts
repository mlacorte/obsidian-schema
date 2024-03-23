/* eslint-disable no-unreachable-loop */
/* eslint-disable no-labels */
import { type Text } from "@codemirror/state";
import { type Tree, type TreeCursor } from "@lezer/common";
import {
  $any,
  $never,
  type IExprCtx,
  type IObjectCtx,
  type Type,
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
  expr: do {
    switch (cursor.type.id) {
      case Lambda: {
        cursor.next(); // => "("
        cursor.next(); // => LambdaArgs
        const args: Array<[string, Type]> = [];

        args: while (true) {
          cursor.next();

          switch (cursor.type.id as unknown) {
            case Arg:
              args.push([text.sliceString(cursor.from, cursor.to), $any]);
              break;
            case TypedArg:
              console.log("TODO");
              break;
            default:
              break args;
          }
        }
        console.log(cursor.name);
        break expr;
      }
      default:
        console.error("UNKNOWN:", cursor.name);
        break expr;
    }
  } while (cursor.next());

  return $never("TODO");
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
