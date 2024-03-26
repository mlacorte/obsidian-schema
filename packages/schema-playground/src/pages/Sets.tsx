import { Text } from "@codemirror/state";
import { type JSX } from "solid-js";

export const name = "Sets";

export const article = (): JSX.Element => (
  <>
    <h1>Sets</h1>
    <p>Introduce people to sets here.</p>
  </>
);

export const editor = Text.of(["// Sets"]);
