import "./App.css";

import { classHighlighter, highlightCode } from "@lezer/highlight";
import { $never, type Type } from "schema";
import { schemaLanguage } from "schema-parser";
import { type Accessor, createSignal, type JSX } from "solid-js";
import { Panel, PanelGroup, ResizeHandle } from "solid-resizable-panels";

import classes from "./App.module.css";
import { Editor } from "./Editor";

interface CodeProps {
  type: Accessor<Type>;
}

export const Code = (props: CodeProps): JSX.Element => {
  const parser = schemaLanguage.parser;

  const res = (): HTMLElement => {
    const code = props.type().toString();
    const result = document.createElement("code");

    const emit = (text: string, classes = ""): void => {
      let node: Node = document.createTextNode(text);

      if (classes.length !== 0) {
        const span = document.createElement("span");
        span.appendChild(node);
        span.className = classes;
        node = span;
      }

      result.appendChild(node);
    };

    const emitBreak = (): void => {
      result.appendChild(document.createTextNode("\n"));
    };

    highlightCode(code, parser.parse(code), classHighlighter, emit, emitBreak);

    return result;
  };

  return <>{res()}</>;
};

export const App = (): JSX.Element => {
  const [type, setType] = createSignal<Type>($never);

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
          <p>
            <code>{`{ json: true }`}</code>
          </p>
          <select>
            <option>One</option>
            <option>Two</option>
            <option>Three</option>
          </select>
        </Panel>
        <ResizeHandle />
        <Panel tag="section" id="playground" class={classes.playground}>
          <PanelGroup direction="column">
            <Panel tag="div" id="editor" class={classes.editor}>
              <Editor setType={setType} />
            </Panel>
            <ResizeHandle />
            <Panel tag="div" id="results" class={classes.results}>
              <Code type={type} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </>
  );
};
