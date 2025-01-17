import { type NodePropSource } from "@lezer/common";
import { styleTags, tags } from "@lezer/highlight";

export const highlight: NodePropSource = styleTags({
  '"//"': tags.lineComment,
  '"/*" "*/"': tags.blockComment,
  this: tags.self,
  Identifier: tags.variableName,
  Tag: tags.tagName,
  DotIdentifier: tags.propertyName,
  Null: tags.null,
  String: tags.string,
  Number: tags.number,
  Bool: tags.bool,
  "Duration/... Date/...": tags.literal,
  "\\": tags.escape,
  "override protected": tags.modifier,
  "and or of include": tags.operatorKeyword,
  local: tags.definitionKeyword,
  '"*" "/" + - %': tags.arithmeticOperator,
  '"!"': tags.logicOperator,
  '>= <= "!=" > < =': tags.compareOperator,
  ":": tags.punctuation,
  ",": tags.separator,
  "[ ]": tags.squareBracket,
  "( )": tags.paren,
  "%{ { }": tags.brace,
  Link: tags.link,
  PropertyIdentifier: tags.definition(tags.propertyName),
  "LocalProperty/PropertyIdentifier": tags.definition(
    tags.local(tags.propertyName)
  )
});
