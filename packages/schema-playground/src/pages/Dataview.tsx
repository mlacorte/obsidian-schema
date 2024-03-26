import { Text } from "@codemirror/state";
import { type JSX } from "solid-js";

export const name = "Dataview";

export const article = (): JSX.Element => (
  <>
    <h1>Dataview</h1>
    <p>Introduce people to Dataview here.</p>
  </>
);

export const editor = Text.of(["// Dataview"]);
