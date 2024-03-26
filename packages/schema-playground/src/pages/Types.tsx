import { Text } from "@codemirror/state";
import { type JSX } from "solid-js";

export const name = "Types";

export const article = (): JSX.Element => (
  <>
    <h1>Types</h1>
    <p>Introduce people to types here.</p>
  </>
);

export const editor = Text.of(["// Types"]);
