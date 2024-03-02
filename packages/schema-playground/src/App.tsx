import "solid-resizable-panels/styles.css";

import { createSignal, type JSX } from "solid-js";
import { Panel, PanelGroup, ResizeHandle } from "solid-resizable-panels";

import classes from "./App.module.css";

export const App = (): JSX.Element => {
  const [_count, _setCount] = createSignal(0);

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
              Editor
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
