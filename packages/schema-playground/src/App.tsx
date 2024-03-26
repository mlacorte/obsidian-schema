import "./App.css";

import { type Text } from "@codemirror/state";
import { A, Navigate, useLocation } from "@solidjs/router";
import { $never, type Type } from "schema";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Panel, PanelGroup, ResizeHandle } from "solid-resizable-panels";

import classes from "./App.module.css";
import Logo from "./assets/logo.svg";
import { Editor } from "./Editor";
import { Output } from "./Output";
import * as Dataview from "./pages/Dataview";
import * as Functions from "./pages/Functions";
import * as Introduction from "./pages/Introduction";
import * as Sets from "./pages/Sets";
import * as Types from "./pages/Types";

const links: Array<{ name: string; url: string }> = [
  {
    name: "Functions",
    url: "https://blacksmithgu.github.io/obsidian-dataview/reference/functions/"
  },
  {
    name: "Expressions",
    url: "https://blacksmithgu.github.io/obsidian-dataview/reference/expressions/"
  },
  { name: "GitHub", url: "https://github.com/mlacorte/obsidian-schema" }
];

export interface Page {
  name: string;
  article: Component;
  editor: Text;
}

const pages = new Map<string, Page>([
  ["/", Introduction],
  ["/dataview", Dataview],
  ["/types", Types],
  ["/functions", Functions],
  ["/sets", Sets]
]);

export const App = (): JSX.Element => {
  const [type, setType] = createSignal<Type>($never);
  const location = useLocation();

  return (
    <Show
      when={pages.has(location.pathname)}
      fallback={<Navigate href={"/"} />}
    >
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
            {links.map(({ name, url }) => (
              <li>
                <a target="_blank" href={url}>
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <PanelGroup tag="main" class={classes.main}>
        <aside class={classes.sidebar}>
          <nav>
            <ul>
              {[...pages.entries()].map(([path, { name }]) => (
                <li>
                  <A href={path} end>
                    {name}
                  </A>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <Panel tag="article" id="docs" class={classes.docs} initialSize={46.5}>
          <Dynamic component={pages.get(location.pathname)!.article} />
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
              <Editor
                setType={setType}
                initialText={pages.get(location.pathname)!.editor}
              />
            </Panel>
            <ResizeHandle />
            <Panel tag="div" id="results" class={classes.results}>
              <Output type={type} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </Show>
  );
};
