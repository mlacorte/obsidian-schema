import * as P from "parsimmon";

export type SchemaExpr = { type: "types"; value: Map<string, unknown> };

export type NoteNode = P.Node<"text", string> | P.Node<"schema", SchemaExpr[]>;

const $chars = "(\\.|.)";
const $sep = "%schema%";
const $body = `((?!${$sep})${$chars})*`;
const $schema = `${$sep}(${$chars}*?)${$sep}`;
const $text = `((?!${$schema})${$chars})+`;
const $ = (str: string) => new RegExp(str, "i");

const empty = P.eof
  .node("text")
  .map((s) => [s])
  .desc("empty text block");

const sep = P.regexp($($sep)).desc("schema separator");
const body = P.regexp($($body)).desc("schema body");

export const TextBlock = P.regexp($($text)).node("text").desc("text block");

export const SchemaBlock = P.seq(sep, body, sep)
  // .map((seq) => seq[1])
  .map(() => [])
  .node("schema")
  .desc("schema block");

export const Note = empty
  .or(P.alt<NoteNode>(TextBlock, SchemaBlock).many())
  .desc("note");
