import * as P from "parsimmon";

type SchemaType = P.Node<string, string>;

const $chars = "(?:\\.|.)";
const $schema = `%schema%(${$chars}*)%schema%`;
const $text = `((?!${$schema})${$chars})+`;
const $ = (str: string) => new RegExp(str, "i");

const text = P.regexp($($text)).node("text");
const schema = P.regexp($($schema), 1).node("schema");
const remainder = P.regexp(/.*$/).node("text");

export const Schema: P.Parser<SchemaType[]> = P.seqMap(
  P.alt<SchemaType>(text, schema).many(),
  remainder,
  (results, result) => (results.length === 0 ? [result] : results)
);
