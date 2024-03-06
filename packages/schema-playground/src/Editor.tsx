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
import { schema } from "schema-parser";
import { type JSX, onCleanup, onMount } from "solid-js";

const color = "var(--pico-color)";
const fontSize = "var(--pico-font-size)";
const inherit = "100%";
const fontWeight = "var(--pico-font-weight)";
const backgroundColor = "var(--pico-background-color)";
const lineHeight = "var(--pico-line-height)";
const fontFamily = "var(--pico-font-family-monospace)";
const cursor = "var(--pico-color)";
const selection = "var(--pico-text-selection-color)";
const darkBackground = backgroundColor;
const codeBackground = "var(--pico-code-background-color)";
const highlightBackground = selection;
const tooltipBackground = codeBackground;

export const svg = (content: string, attrs = `viewBox="0 0 40 40"`): string =>
  `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${encodeURIComponent(content)}</svg>')`;

export const underline = (color: string): string =>
  svg(
    `<path d="m0 2.5 l2 -1.5 l1 0 l2 1.5 l1 0" stroke="${color}" fill="none" stroke-width=".7"/>`,
    `width="6" height="3"`
  );

const theme = EditorView.theme({
  // base
  "&": {
    color,
    fontFamily,
    fontSize: inherit,
    fontWeight,
    backgroundColor,
    lineHeight
  },

  ".cm-content": {
    caretColor: cursor,
    fontFamily
  },

  ".cm-cursor, .cm-dropCursor": { borderLeftColor: cursor },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: selection },

  ".cm-panels": { backgroundColor: darkBackground, color },
  ".cm-panels.cm-panels-top": { borderBottom: "var(--schema-border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "var(--schema-border)" },

  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f"
  },

  ".cm-activeLine": { backgroundColor: "#6699ff0b" },
  ".cm-selectionMatch": { backgroundColor: "#aafe661a" },

  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "#bad0f847"
  },

  ".cm-gutters": {
    fontSize: inherit,
    fontFamily,
    lineHeight,
    backgroundColor: codeBackground,
    color,
    border: "none"
  },

  ".cm-activeLineGutter": {
    backgroundColor: highlightBackground
  },

  ".cm-foldGutter": {
    marginTop: "-4px"
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd"
  },

  ".cm-tooltip": {
    fontFamily,
    border: "none",
    backgroundColor: tooltipBackground,
    "& > *": {
      margin: 0
    }
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground,
    borderBottomColor: tooltipBackground
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBackground,
      color,
      fontSize
    }
  },
  // linter
  ".cm-diagnostic": {
    padding: "3px 6px 3px 8px",
    marginBottom: "0",
    marginLeft: "-1px",
    display: "block",
    whiteSpace: "pre-wrap"
  },
  ".cm-diagnostic-error": { borderLeft: "5px solid #d11" },
  ".cm-diagnostic-warning": { borderLeft: "5px solid orange" },
  ".cm-diagnostic-info": { borderLeft: "5px solid #999" },
  ".cm-diagnostic-hint": { borderLeft: "5px solid #66d" },

  ".cm-diagnosticAction": {
    font: "inherit",
    border: "none",
    padding: "2px 4px",
    backgroundColor: tooltipBackground,
    color,
    borderRadius: "3px",
    marginLeft: "8px",
    cursor: "pointer"
  },

  ".cm-diagnosticSource": {
    fontSize,
    opacity: 1
  },

  ".cm-lintRange": {
    backgroundPosition: "left bottom",
    backgroundRepeat: "repeat-x",
    paddingBottom: "0.7px"
  },

  ".cm-lintRange-error": { backgroundImage: underline("#d11") },
  ".cm-lintRange-warning": { backgroundImage: underline("orange") },
  ".cm-lintRange-info": { backgroundImage: underline("#999") },
  ".cm-lintRange-hint": { backgroundImage: underline("#66d") },
  ".cm-lintRange-active": { backgroundColor: "#ffdd9980" },

  ".cm-tooltip-lint": {
    padding: 0,
    margin: 0
  },

  ".cm-lintPoint": {
    position: "relative",

    "&:after": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: "-2px",
      borderLeft: "3px solid transparent",
      borderRight: "3px solid transparent",
      borderBottom: "4px solid #d11"
    }
  },

  ".cm-lintPoint-warning": {
    "&:after": { borderBottomColor: "orange" }
  },
  ".cm-lintPoint-info": {
    "&:after": { borderBottomColor: "#999" }
  },
  ".cm-lintPoint-hint": {
    "&:after": { borderBottomColor: "#66d" }
  },

  ".cm-panel.cm-panel-lint": {
    position: "relative",
    "& ul": {
      maxHeight: "100px",
      overflowY: "auto",
      "& [aria-selected]": {
        backgroundColor: "#ddd",
        "& u": { textDecoration: "underline" }
      },
      "&:focus [aria-selected]": {
        background_fallback: codeBackground,
        backgroundColor: highlightBackground,
        color_fallback: color,
        color
      },
      "& u": { textDecoration: "none" },
      padding: 0,
      margin: 0,
      "& li": {
        margin: 0
      }
    },
    "& [name=close]": {
      position: "absolute",
      top: "0",
      right: "2px",
      background: "inherit",
      border: "none",
      font: "inherit",
      color: "var(--pico-muted-color)",
      padding: "3px 6px 3px 8px",
      margin: 0
    }
  }
});

export const extensions: Extension = (() => [
  theme,
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
  ]),
  schema()
])();

const doc = `local cmp: (a,b) => error("NEVER"),
local cmp: (a,b) => a < b,

foo: {
  a: 10,
  bar: this.bar.foo,
  of string,
},

bar: {
  foo: this.foo.a,
},

other:
  local a: 10,
  local b: 20,
  [a, b, a + b],

test: local a: 10, a,

a: 20,
b: 10 or 30,
c: choice(
  cmp(this.a, this.b),
  this.a + 3,
  this.b + 5
),

c: 23,

/*
cmp/1: <lambda>,
cmp/2: <lambda>,
a/1: 20,
b/1: 30,
c/1: 20,

c/1 -> {a/1, b/1, cmp/2}
*/`;

export const Editor = (): JSX.Element => {
  // eslint-disable-next-line prefer-const
  let editorViewDiv: HTMLDivElement = undefined as unknown as HTMLDivElement;
  let editorView: EditorView;

  onMount(() => {
    editorView = new EditorView({
      extensions,
      parent: editorViewDiv,
      doc
    });
  });

  onCleanup(() => {
    editorView.destroy();
  });

  return <div ref={editorViewDiv} />;
};
