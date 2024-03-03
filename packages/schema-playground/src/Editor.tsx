import "./Editor.css";

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import { EditorView } from "codemirror";
import { type JSX, onCleanup, onMount } from "solid-js";

export const extensions: Extension = (() => [
  EditorView.lineWrapping,
  lineNumbers(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab
  ])
])();

export const Editor = (): JSX.Element => {
  // eslint-disable-next-line prefer-const
  let editorViewDiv: HTMLDivElement = undefined as unknown as HTMLDivElement;
  let editorView: EditorView;

  onMount(() => {
    editorView = new EditorView({
      extensions: [extensions],
      parent: editorViewDiv
    });
  });

  onCleanup(() => {
    editorView.destroy();
  });

  return <div ref={editorViewDiv} />;
};
