import { type JSX } from "solid-js";

export const code = (text: string): JSX.Element => {
  let lines = text.split("\n");
  const whitespace = /^\s*$/;

  let start = 0;
  let stop = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!whitespace.test(lines[i])) {
      start = i;
      break;
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (!whitespace.test(lines[i])) {
      stop = i;
      break;
    }
  }

  lines = lines.slice(start, stop + 1);

  const dedent = Math.min(...lines.map((t) => t.search(/\S/)));
  if (dedent !== 0) lines = lines.map((t) => t.slice(dedent));

  return <Code text={lines.join("\n")} />;
};

export const Code = (props: { text: string }): JSX.Element => (
  <pre>
    <code>{props.text}</code>
  </pre>
);
