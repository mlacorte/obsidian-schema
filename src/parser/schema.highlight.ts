import { styleTags, tags } from "@lezer/highlight";

export const highlight = styleTags({
  '"//"': tags.lineComment,
  '"/*"': tags.blockComment,
  Identifier: tags.variableName,
  Tag: tags.tagName,
  DotIdentifier: tags.propertyName,
  String: tags.string,
  Number: tags.number,
  Bool: tags.bool,
  "\\": tags.escape,
  "override protected": tags.modifier,
  "and or of include": tags.operatorKeyword,
  local: tags.definitionKeyword,
  '"*" "/" + -': tags.arithmeticOperator,
  '"!" & |': tags.logicOperator,
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
