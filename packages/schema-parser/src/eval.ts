/* eslint-disable no-unreachable-loop */
/* eslint-disable no-labels */
import { type Text } from "@codemirror/state";
import { type IterMode, type Tree, type TreeCursor } from "@lezer/common";
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
  OverrideProperty,
  Property,
  PropertyIdentifier,
  String as _String,
  Tag,
  TypedArg
} from "./parser/schema.parser.terms";

class SchemaCursor {
  constructor(
    private readonly _cursor: TreeCursor,
    private readonly _text: Text
  ) {
    while (this.isSkipped) {
      this._cursor.next();
    }
  }

  get id(): number {
    return this._cursor.type.id;
  }

  get name(): string {
    return this._cursor.type.name;
  }

  get text(): string {
    return this._text.sliceString(this._cursor.from, this._cursor.to);
  }

  clone(mode?: IterMode): SchemaCursor {
    return new SchemaCursor(this._cursor.node.cursor(mode), this._text);
  }

  private get isSkipped(): boolean {
    return this._cursor.type.isSkipped || !/^[A-Z]/.test(this._cursor.name);
  }

  next(enter?: boolean): boolean {
    while (true) {
      const res = this._cursor.next(enter);
      if (!res || !this.isSkipped) return res;
    }
  }

  parent(): boolean {
    return this._cursor.parent();
  }

  firstChild(): boolean {
    if (!this._cursor.firstChild()) return false;
    return this.isSkipped ? this.nextSibling() : true;
  }

  nextSibling(): boolean {
    while (true) {
      const res = this._cursor.nextSibling();
      if (!res || !this.isSkipped) return res;
    }
  }

  hasError(): boolean {
    const cursor = this._cursor.node.cursor();

    do {
      if (cursor.type.isError) return true;
    } while (cursor.next());

    return false;
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
      return cursor.text;
  }

  return JSON.parse(cursor.text);
};

const evalExpr = (cursor: SchemaCursor, c: IExprCtx): TypeRef => {
  switch (cursor.id as unknown) {
    case LocalExpression: {
      cursor.firstChild(); // => propertyKey
      const name = readProp(cursor);
      cursor.nextSibling(); // => expression
      const lazyCursor = cursor.clone();
      c.local(name, (c) => evalExpr(lazyCursor, c));
      cursor.nextSibling(); // => expression
      return evalExpr(cursor, c);
    }
    case Not:
      cursor.firstChild(); // => expression
      return c.not(evalExpr(cursor, c));
    case Identifier:
      return c.get(cursor.text);
    case Bool:
      return $boolean(/^true$/i.test(cursor.text));
    case Null:
      return $null;
    case _Number:
      return $number(Number(cursor.text));
    case _String:
      return $string(JSON.parse(cursor.text) as string);
    case _Object:
      return c.obj((c) => {
        cursor.firstChild(); // => Block
        evalBlock(cursor, c);
      });
    case _Array:
      return c.arr((c) => {
        evalArr(cursor, c);
      });
    case Lambda: {
      cursor.firstChild(); // => LambdaArgs
      const args: Array<[string, TypeRef]> = [];

      args: while (cursor.next() /* Arg or TypedArg or LambdaExpr */) {
        switch (cursor.id as unknown) {
          case Arg:
            cursor.firstChild(); // => Identifier;
            args.push([cursor.text, $any]);
            break;
          case TypedArg: {
            cursor.firstChild(); // => Identifier
            const arg = cursor.text;
            cursor.nextSibling(); // => expression
            args.push([arg, evalExpr(cursor, c)]);
            break;
          }
          default:
            break args;
        }
      }

      cursor.firstChild(); // => expression
      return c.fn(args, (c) => evalExpr(cursor, c));
    }
    default:
      return $never(`UNKNOWN: ${cursor.name}`);
  }
};

const evalArr = (cursor: SchemaCursor, c: IArrayCtx): void => {
  if (!cursor.firstChild()) return;

  do {
    switch (cursor.id as unknown) {
      case Of: {
        cursor.firstChild(); // => expression
        const lazyCursor = cursor.clone();
        c.of((c) => evalExpr(lazyCursor, c));
        cursor.parent();
        break;
      }
      default: {
        const lazyCursor = cursor.clone();
        c.set((c) => evalExpr(lazyCursor, c));
        break;
      }
    }
  } while (cursor.nextSibling());
};

const evalBlock = (cursor: SchemaCursor, c: IObjectCtx): void => {
  if (!cursor.firstChild()) return;

  block: do {
    switch (cursor.id as unknown) {
      case Of: {
        cursor.firstChild(); // => expression
        const lazyCursor = cursor.clone();
        c.of((c) => evalExpr(lazyCursor, c));
        break;
      }
      case Include: {
        cursor.firstChild(); // => expression
        const lazyCursor = cursor.clone();
        c.include((c) => evalExpr(lazyCursor, c));
        break;
      }
      case LocalProperty: {
        cursor.firstChild(); // => propertyKey
        const name = readProp(cursor);
        cursor.nextSibling(); // => expression
        const lazyCursor = cursor.clone();
        c.local(name, (c) => evalExpr(lazyCursor, c));
        break;
      }
      // TODO: add override logic
      case Property:
      case OverrideProperty: {
        cursor.firstChild(); // => propertyKey
        const name = readProp(cursor);
        cursor.nextSibling(); // => expression;
        const lazyCursor = cursor.clone();
        c.set(name, (c) => evalExpr(lazyCursor, c));
        break;
      }
      default:
        console.error("UNKNOWN:", cursor.name);
        break block;
    }

    cursor.parent();
  } while (cursor.nextSibling());
};

export const treeEval =
  (doc: Text, tree: Tree) =>
  (c: IObjectCtx): void => {
    const cursor = new SchemaCursor(tree.cursor(), doc);
    if (cursor.hasError()) {
      c.include(() => $never("Syntax error"));
      return;
    }
    cursor.firstChild(); // => Block
    evalBlock(cursor, c);
  };
