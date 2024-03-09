import {
  $any,
  $number,
  $string,
  builtins,
  ops,
  type SingleType,
  type Type
} from ".";
import { type id, type TypeSet } from "./typeset";

export type path = string & { path: never };
export type identifier = string & { identifier: never };

export type Ast =
  | SingleType
  | AstRef
  | AstLocal
  | AstCall
  | AstFn
  | AstObj
  | AstArr
  | AstOr
  | AstAnd;

export interface AstRef {
  type: "ast/ref";
  ref: string;
  subRefs: string[];
}

export interface AstLocal {
  type: "ast/local";
  key: string;
  val: Ast;
  expr: Ast;
}

export interface AstCall {
  type: "ast/call";
  fn: Ast;
  args: Ast[];
}

export interface AstFn {
  type: "ast/fn";
  args: Array<[key: string, type: Type]>;
  body: Ast;
}

export interface AstObj {
  type: "ast/obj";
  known: Array<
    [local: "local", key: string, val: Ast] | [key: string, val: Ast]
  >;
  unknown: Ast;
}

export interface AstArr {
  type: "ast/arr";
  known: Ast[];
  unknown: Ast;
}

export interface AstOr {
  type: "ast/or";
  vals: Ast[];
}

export interface AstAnd {
  type: "ast/and";
  vals: Ast[];
}

export const ref = (ref: string, subRefs: string[] = []): AstRef => ({
  type: "ast/ref",
  ref,
  subRefs
});

export const local = (key: string, val: Ast, expr: Ast): AstLocal => ({
  type: "ast/local",
  key,
  val,
  expr
});

export const call = (fn: Ast, args: Ast[]): AstCall => ({
  type: "ast/call",
  fn,
  args
});

export const fn = (
  args: Array<string | [key: string, type: Type]>,
  body: Ast
): AstFn => ({
  type: "ast/fn",
  args: args.map((arg) => (typeof arg === "string" ? [arg, $any] : arg)),
  body
});

export const obj = (
  known: Array<
    [local: "local", key: string, val: Ast] | [key: string, val: Ast]
  > = [],
  unknown: Ast = $any
): AstObj => ({
  type: "ast/obj",
  known,
  unknown
});

export const arr = (known: Ast[] = [], unknown: Ast = $any): AstArr => ({
  type: "ast/arr",
  known,
  unknown
});

export const or = (a: Ast, ...bs: Ast[]): Ast =>
  bs.length === 0
    ? a
    : {
        type: "ast/or",
        vals: [a, ...bs].flatMap((v) => (v.type === "ast/or" ? v.vals : [v]))
      };

export const and = (a: Ast, ...bs: Ast[]): Ast =>
  bs.length === 0
    ? a
    : {
        type: "ast/and",
        vals: [a, ...bs].flatMap((v) => (v.type === "ast/and" ? v.vals : [v]))
      };

export interface INote {
  ast: AstObj;
  ids: Set<id>;
  deps: Set<path>;
  reverseDeps: Set<path>;
}

export interface IGlobalContext {
  ctr: id;
  notes: Map<path, INote>;
}

export interface IContext {
  global: IGlobalContext;
  note: INote;
  branches: Map<id, TypeSet>;
  scope: AstObj;
}

export class Context implements IGlobalContext {
  public ctr = BigInt(1);
  public notes = new Map<path, INote>();
  public branches = new Map<id, TypeSet>();

  add(path: path, ast: AstObj): this {
    const $this = ast;
    const scope = obj([...Object.entries(builtins), ["this", $this]]);
    const note: INote = {
      ast: scope,
      ids: new Set(),
      deps: new Set(),
      reverseDeps: new Set()
    };

    this.notes.set(path, note);

    return this;
  }

  remove(path: path): Set<path> {
    const tbd = new Set([path]);
    const deleted = new Set<path>();

    while (tbd.size > 0) {
      const path: path = tbd.values().next().value;
      const note = this.notes.get(path)!;

      // mark as deleted
      tbd.delete(path);
      deleted.add(path);

      // delete the types
      for (const id of note.ids) {
        this.branches.delete(id);
      }

      // queue reverse deps for deletion
      for (const dep of note.reverseDeps) {
        if (!deleted.has(dep)) tbd.add(dep);
      }
    }

    return deleted;
  }
}

// export const branchRef = (ctx: IContext, union: Type): Branch => {
//   // shallow
//   const set = $val(ctx.global.ctr++, union);
//   ctx.note.ids.add(set.id);
//   ctx.branches.set(set.id, set);

//   return { type: "branch", id: set.id };
// };

// export const fromBranchRef = (ctx: IContext, branch: Branch): Type =>
//   ctx.branches
//     .get(branch.id)!
//     .potentials.reduce<Type>((res, branch) => res.or(branch.type), $never);

const _test: Ast = obj([
  ["local", "cmp", fn(["a", "b"], call(ref("error"), [$string("NEVER")]))],
  ["local", "cmp", fn(["a", "b"], call(ops.lt, [ref("a"), ref("b")]))],
  [
    "foo",
    obj([
      ["a", $number(10)],
      ["bar", ref("this", ["bar", "foo"])]
    ])
  ],
  ["bar", obj([["foo", ref("this", ["foo", "a"])]])],
  [
    "other",
    local(
      "a",
      $number(10),
      local(
        "b",
        $number(10),
        arr([ref("a"), ref("b"), call(ops.plus, [ref("a"), ref("b")])])
      )
    )
  ],
  ["test", local("a", $number(10), ref("a"))],
  ["a", $number(20)],
  ["b", or($number(10), $number(30))],
  [
    "c",
    call(ref("choice"), [
      call(ref("cmp"), [ref("this", ["a"]), ref("this", ["b"])]),
      call(ops.plus, [ref("this", ["a"]), $number(3)]),
      call(ops.plus, [ref("this", ["b"]), $number(5)])
    ])
  ]
]);
