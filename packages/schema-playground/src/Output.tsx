import { type Type } from "schema";
import { type Accessor, type JSX } from "solid-js";

interface Line {
  indent: number;
  bold: boolean;
  chunks: string[];
}

class Lines {
  public all: Line[];
  public current: Line;

  constructor(
    public indent: number,
    bold: boolean
  ) {
    this.current = { indent, bold, chunks: [] };
    this.all = [this.current];
  }

  append(text: string): void {
    this.current.chunks.push(text);
  }

  newLine(indent: number, bold: boolean): void {
    this.current = { indent, bold, chunks: [] };
    this.all.push(this.current);
  }
}

const emit = (type: Type, prev: boolean): boolean => {
  if (!prev || type.types.length > 1) return false;
  if (type.type === "object") return true;
  if (type.type === "array") {
    return (type as Type<"array">).values[0].known.every((t) => !t.isType());
  }
  return !type.isType();
};

const formatRec = (type: Type, lines: Lines): Lines => {
  const last = type.types.length - 1;

  for (const [i, t] of type.splitTypesShallow().entries()) {
    if (t.is("array")) {
      const outer = lines.current;
      lines.append("[");

      for (const val of t.value.known) {
        lines.newLine(outer.indent + 1, emit(val, outer.bold));
        formatRec(val, lines);
        lines.append(",");
      }

      lines.newLine(outer.indent + 1, false);
      lines.append("of ");
      formatRec(t.value.unknown, lines);
      lines.append(",");

      lines.newLine(outer.indent, outer.bold);
      lines.append("]");
    } else if (t.is("object")) {
      const outer = lines.current;
      lines.append("{");

      const values: Array<[string, Type]> = [];
      const types: Array<[string, Type]> = [];

      for (const [prop, val] of t.value.known.entries()) {
        if (emit(val, true)) {
          values.push([prop, val]);
        } else {
          types.push([prop, val]);
        }
      }

      for (const [prop, val] of values) {
        lines.newLine(outer.indent + 1, emit(val, outer.bold));
        lines.append(prop);
        lines.append(": ");
        formatRec(val, lines);
        lines.append(",");
      }

      for (const [prop, val] of types) {
        lines.newLine(outer.indent + 1, emit(val, outer.bold));
        lines.append(prop);
        lines.append(": ");
        formatRec(val, lines);
        lines.append(",");
      }

      lines.newLine(outer.indent + 1, false);
      lines.append("of ");
      formatRec(t.value.unknown, lines);
      lines.append(",");

      lines.newLine(outer.indent, outer.bold);
      lines.append("}");
    } else {
      const vals = [...t.splitTypes()];
      const last = vals.length - 1;

      for (const [i, val] of vals.entries()) {
        lines.append(val.toString());

        if (i !== last) {
          lines.append(" or ");
        }
      }
    }

    if (i !== last) {
      lines.append(" or ");
    }
  }

  return lines;
};

interface OutputProps {
  type: Accessor<Type>;
}

export const Output = (props: OutputProps): JSX.Element => {
  const lines = (): JSX.Element => {
    const type = props.type();

    if (type.type === "never") {
      return <b>Syntax error!</b>;
    }

    return formatRec(type, new Lines(0, true)).all.map((line) => {
      const str = "  ".repeat(line.indent) + line.chunks.join("") + "\n";
      return line.bold ? (
        <b>{str}</b>
      ) : (
        <i style="color: var(--pico-contrast-underline)">{str}</i>
      );
    });
  };

  return (
    <pre>
      <code>{lines()}</code>
    </pre>
  );
};
