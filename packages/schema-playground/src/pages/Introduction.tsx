import { Text } from "@codemirror/state";
import { type JSX } from "solid-js";

import { Code } from "../Code";

export const name = "Introduction";

export const article = (): JSX.Element => (
  <>
    <h1>Introduction</h1>
    <p>Describe how to use schema editor here.</p>
    <Code
      text={`json: true,
other: val,`}
    />
    <select>
      <option>One</option>
      <option>Two</option>
      <option>Three</option>
    </select>
  </>
);

export const editor = Text.of([
  'local cmp: (a,b) => error("NEVER"),',
  "local cmp: (a,b) => a < b,",
  "",
  'fired: "fired",',
  'pending: "pending",',
  "event: { status: this.fired } or { status: this.pending },",
  "",
  "foo: {",
  "  a: 10,",
  "  bar: this.bar.foo,",
  "  of string,",
  "},",
  "",
  "bar: {",
  "  foo: this.foo.a,",
  "},",
  "",
  "other:",
  "  local a: 10,",
  "  local b: 20,",
  "  [a, b, a + b],",
  "",
  "test: local a: 10, a,",
  "",
  "a: 20,",
  "b: 10 or 30,",
  "c: choice(",
  "  cmp(this.a, this.b),",
  "  this.a + 3,",
  "  this.b + 5",
  "),",
  "",
  "c: 23,",
  "",
  "/*",
  "cmp/1: <lambda>,",
  "cmp/2: <lambda>,",
  "a/1: 20,",
  "b/1: 30,",
  "c/1: 20,",
  "",
  "c/1 -> {a/1, b/1, cmp/2}",
  "*/"
]);
