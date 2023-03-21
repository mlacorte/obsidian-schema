import * as L from "luxon";
import { Link, Widget } from "obsidian-dataview";

import * as T from "./types";

// utility
export function literal(arg: null): T.NullType;
export function literal(arg: number): T.NumberType;
export function literal(arg: string): T.StringType;
export function literal(arg: boolean): T.BooleanType;
export function literal(arg: L.DateTime): T.DateType;
export function literal(arg: L.Duration): T.DurationType;
export function literal(arg: Link): T.LinkType;
export function literal(arg: Widget): T.WidgetType;
export function literal(arg: Record<string | number, T.Type>): T.ObjectType;
export function literal(arg: T.Type[]): T.ArrayType;
export function literal(
  arg:
    | null
    | number
    | string
    | boolean
    | L.DateTime
    | L.Duration
    | Link
    | Widget
    | Record<string, T.Type>
    | T.Type[]
): T.Type {
  if (arg === null) {
    return T.Null;
  }

  if (typeof arg === "number") {
    return T.Number.literal(arg);
  }

  if (typeof arg === "string") {
    return T.String.literal(arg);
  }

  if (typeof arg === "boolean") {
    return T.Boolean.literal(arg);
  }

  if (arg instanceof L.DateTime) {
    return T.Date.literal(arg);
  }

  if (arg instanceof L.Duration) {
    return T.Duration.literal(arg);
  }

  if (arg instanceof Link) {
    return T.Link.literal(arg);
  }

  if (arg instanceof Widget) {
    return T.Widget.literal(arg);
  }

  if (Array.isArray(arg)) {
    return T.Array.literal(arg);
  }

  return T.Object.literal(arg);
}
