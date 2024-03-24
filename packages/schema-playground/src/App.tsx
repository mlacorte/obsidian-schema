import "./App.css";

import { $never, type Type } from "schema";
import { createSignal, type JSX } from "solid-js";
import { Panel, PanelGroup, ResizeHandle } from "solid-resizable-panels";

import Logo from "../public/logo.svg";
import classes from "./App.module.css";
import { code } from "./Code";
import { Editor } from "./Editor";
import { Output } from "./Output";

export const App = (): JSX.Element => {
  const [type, setType] = createSignal<Type>($never);

  return (
    <>
      <header class={classes.header}>
        <nav>
          <ul>
            <li>
              <Logo />
            </li>
            <li>
              <strong>Obsidian Schema</strong>
            </li>
          </ul>
          <ul>
            <li>
              <a
                target="_blank"
                href="https://blacksmithgu.github.io/obsidian-dataview/reference/functions/"
              >
                Functions
              </a>
            </li>
            <li>
              <a
                target="_blank"
                href="https://blacksmithgu.github.io/obsidian-dataview/reference/expressions/"
              >
                Expressions
              </a>
            </li>
            <li>
              <a
                target="_blank"
                href="https://github.com/mlacorte/obsidian-schema"
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <PanelGroup tag="main" class={classes.main}>
        <Panel
          tag="aside"
          id="sidebar"
          class={classes.sidebar}
          minSize={10}
          initialSize={10}
        >
          <nav>
            <ul>
              <li>
                <a href="#">Introduction</a>
              </li>
              <li>
                <a href="#">Dataview Overview</a>
              </li>
              <li>
                <a href="#">Types</a>
              </li>
              <li>
                <a href="#">Functions</a>
              </li>
              <li>
                <a href="#">Sets</a>
              </li>
            </ul>
          </nav>
        </Panel>
        <ResizeHandle />
        <Panel tag="article" id="docs" class={classes.docs}>
          <h1>Tutorial</h1>
          <p>Describe how to use schema editor here.</p>
          {code(`
            json: true,
            other: val,
          `)}
          <select>
            <option>One</option>
            <option>Two</option>
            <option>Three</option>
          </select>
        </Panel>
        <ResizeHandle />
        <Panel tag="section" id="playground" class={classes.playground}>
          <PanelGroup direction="column">
            <Panel
              tag="div"
              id="editor"
              class={classes.editor}
              initialSize={65}
            >
              <Editor setType={setType} />
            </Panel>
            <ResizeHandle />
            <Panel tag="div" id="results" class={classes.results}>
              <Output type={type} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </>
  );
};
