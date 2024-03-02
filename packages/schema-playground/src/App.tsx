import "solid-resizable-panels/styles.css";

import { basicSetup, EditorView } from "codemirror";
import { type JSX, onCleanup, onMount } from "solid-js";
import { Panel, PanelGroup, ResizeHandle } from "solid-resizable-panels";

import classes from "./App.module.css";

export const App = (): JSX.Element => {
  // eslint-disable-next-line prefer-const
  let editorViewDiv: HTMLDivElement = undefined as unknown as HTMLDivElement;
  let editorView: EditorView;

  const theme = EditorView.theme({
    ".cm-selectionBackground": {
      background: "var(--pico-text-selection-color)"
    },
    ".cm-activeLine": { background: "var(--pico-text-selection-color)" },
    ".cm-activeLineGutter": {
      background: "var(--pico-text-selection-color)"
    }
  });

  onMount(() => {
    editorView = new EditorView({
      extensions: [basicSetup, EditorView.lineWrapping, theme],
      parent: editorViewDiv
    });
  });

  onCleanup(() => {
    editorView.destroy();
  });

  return (
    <>
      <header class={classes.header}>Header</header>
      <PanelGroup tag="main" class={classes.main}>
        <Panel
          tag="aside"
          id="sidebar"
          class={classes.sidebar}
          minSize={15}
          initialSize={15}
        >
          Sidebar
        </Panel>
        <ResizeHandle />
        <Panel tag="article" id="docs" class={classes.docs}>
          <h1>Tutorial</h1>
          <p>Describe how to use schema editor here.</p>
        </Panel>
        <ResizeHandle />
        <Panel tag="section" id="playground" class={classes.playground}>
          <PanelGroup direction="column">
            <Panel tag="div" id="editor" class={classes.editor}>
              <div ref={editorViewDiv} />
            </Panel>
            <ResizeHandle />
            <Panel tag="div" id="results" class={classes.results}>
              Results
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </>
  );
};
