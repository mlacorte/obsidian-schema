import { Text } from "@codemirror/state";
import { type JSX } from "solid-js";

export const name = "Functions";

export const article = (): JSX.Element => (
  <>
    <h1>Functions</h1>
    <p>Introduce functions here.</p>
  </>
);

export const editor = Text.of(["// Functions"]);
