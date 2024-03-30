/* eslint-disable no-unreachable-loop */
/* eslint-disable no-labels */
import { type Text } from "@codemirror/state";
import { type Tree, type TreeCursor } from "@lezer/common";
import {
  $any,
  $boolean,
  $never,
  $null,
  $number,
  $string,
  type IArrayCtx,
  type IExprCtx,
  type IObjectCtx,
  type TypeRef
} from "schema";

import {
  _protected,
  Arg,
  Array as _Array,
  Bool,
  Identifier,
  Include,
  Lambda,
  Link,
  LocalExpression,
  LocalProperty,
  Not,
  Null,
  Number as _Number,
  Object as _Object,
  Of,
  override,
  Property,
  PropertyIdentifier,
  String as _String,
  Tag,
  TypedArg
} from "./parser/schema.parser.terms";

class SchemaCursor {
  constructor(
    private readonly cursor: TreeCursor,
    private readonly text: Text
  ) {
    while (this.isSkipped) {
      this.cursor.next();
    }
  }

  get id(): number {
    return this.cursor.type.id;
  }

  get name(): string {
    return this.cursor.type.name;
  }

  get inner(): string {
    return this.text.sliceString(this.cursor.from, this.cursor.to);
  }

  clone(): SchemaCursor {
    return new SchemaCursor(this.cursor.node.cursor(), this.text);
  }

  private get isSkipped(): boolean {
    return (
      this.cursor.type.isSkipped ||
      this.cursor.name === "/*" ||
      this.cursor.name === "//"
    );
  }

  next(enter?: boolean): boolean {
    while (true) {
      const res = this.cursor.next(enter);
      if (!this.isSkipped) return res;
    }
  }

  firstChild(): boolean {
    if (!this.cursor.firstChild()) return false;
    return this.isSkipped ? this.nextSibling() : true;
  }

  nextSibling(): boolean {
    while (true) {
      const res = this.cursor.nextSibling();
      if (!res || !this.isSkipped) return res;
    }
  }
}

// TODO: add Link and Tag types + protection logic
const readProp = (cursor: SchemaCursor): string => {
  if (cursor.id === _protected) {
    cursor.next();
  }

  switch (cursor.id) {
    case PropertyIdentifier:
    case Tag:
    case Link:
      return cursor.inner;
  }

  return JSON.parse(cursor.inner);
};

const evalExpr = (cursor: SchemaCursor, c: IExprCtx): TypeRef => {
  switch (cursor.id) {
    case LocalExpression: {
      cursor.next(); // => "local"
      cursor.next(); // => propertyKey
      const name = readProp(cursor);
      cursor.next(); // => ":"
      cursor.next(); // => expression
      const lazyCursor = cursor.clone();
      c.local(name, (c) => evalExpr(lazyCursor, c));
      cursor.next(false); // => ","
      cursor.next(); // => expression
      return evalExpr(cursor, c);
    }
    case Not:
      cursor.next(); // => "!"
      cursor.next(); // => expression
      return c.not(evalExpr(cursor, c));
    case Identifier:
      return c.get(cursor.inner);
    case Bool:
      return $boolean(/^true$/i.test(cursor.inner));
    case Null:
      return $null;
    case _Number:
      return $number(Number(cursor.inner));
    case _String:
      return $string(JSON.parse(cursor.inner) as string);
    case _Object:
      return c.obj((c) => {
        cursor.next(); // => "{"
        cursor.next(); // => Block
        evalBlock(cursor, c);
      });
    case _Array:
      return c.arr((c) => {
        evalArr(cursor, c);
      });
    case Lambda: {
      cursor.next(); // => "("
      cursor.next(); // => LambdaArgs
      const args: Array<[string, TypeRef]> = [];

      args: while (true) {
        cursor.next(); // => Arg or TypedArg or "=>"

        switch (cursor.id as unknown) {
          case Arg:
            cursor.next(); // => Identifier;
            args.push([cursor.inner, $any]);
            cursor.next(); // => "," or ")";
            break;
          case TypedArg: {
            cursor.next(); // => Identifier
            const arg = cursor.inner;
            cursor.next(); // => ":"
            cursor.next(); // => expression
            args.push([arg, evalExpr(cursor, c)]);
            cursor.next(); // => "," or ")"
            break;
          }
          default:
            break args;
        }
      }

      cursor.next(); // => LambdaExpr
      cursor.next(); // => expression
      return c.fn(args, (c) => evalExpr(cursor, c));
    }
    default:
      return $never(`UNKNOWN: ${cursor.name}`);
  }
};

const evalArr = (cursor: SchemaCursor, c: IArrayCtx): void => {
  cursor.next(); // => "["
  cursor.next(); // => expression or "]";

  while (cursor.name !== "]") {
    switch (cursor.id as unknown) {
      case Of: {
        cursor.next(); // => "of"
        cursor.next(); // => expression
        const lazyCursor = cursor.clone();
        c.of((c) => evalExpr(lazyCursor, c));
        break;
      }
      default: {
        const lazyCursor = cursor.clone();
        c.set((c) => evalExpr(lazyCursor, c));
        break;
      }
    }

    cursor.next(false);
    cursor.nextSibling();
  }
};

const evalBlock = (cursor: SchemaCursor, c: IObjectCtx): void => {
  if (!cursor.firstChild()) return;

  obj: do {
    switch (cursor.id as unknown) {
      case Of: {
        cursor.next(); // => "of"
        cursor.next(); // => expression
        const lazyCursor = cursor.clone();
        c.of((c) => evalExpr(lazyCursor, c));
        break;
      }
      case Include: {
        cursor.next(); // => "include"
        cursor.next(); // => expression
        const lazyCursor = cursor.clone();
        c.include((c) => evalExpr(lazyCursor, c));
        break;
      }
      case LocalProperty: {
        cursor.next(); // => "local"
        cursor.next(); // => propertyKey
        const name = readProp(cursor);
        cursor.next(); // => ":"
        cursor.next(); // => expression
        const lazyCursor = cursor.clone();
        c.local(name, (c) => evalExpr(lazyCursor, c));
        break;
      }
      case Property: {
        cursor.next(); // => "override" or propertyKey
        // TODO: add override logic
        if (cursor.id === override) cursor.next();
        const name = readProp(cursor);
        cursor.next(); // => ":"
        cursor.next(); // => expression;
        const lazyCursor = cursor.clone();
        c.set(name, (c) => evalExpr(lazyCursor, c));
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
    const cursor = new SchemaCursor(tree.cursor(), doc);
    cursor.firstChild(); // => Block
    evalBlock(cursor, c);
  };
