import * as P from "parsimmon";

type SchemaType = P.Node<string, string>;

const $chars = "(?:\\.|.)";
const $schema = `%schema%(${$chars}*?)%schema%`;
const $text = `((?!${$schema})${$chars})+`;
const $ = (str: string) => new RegExp(str, "i");

const text = P.regexp($($text)).node("text");
const schema = P.regexp($($schema), 1).node("schema");
const empty = P.regexp(/^$/).node("text");

export const Schema: P.Parser<SchemaType[]> = empty
  .map((s) => [s])
  .or(P.alt<SchemaType>(text, schema).many());
