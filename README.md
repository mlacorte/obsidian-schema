# Obsidian Schema

## ⚠️ Work in progress!

This plugin is not usable in any form.

## About

**Schema** is a plugin for [Obsidian](https://obsidian.md/) that extends
[Dataview](https://blacksmithgu.github.io/obsidian-dataview/) expressions to
add schema validation and powerful metadata declaration capabilities.

The specifics are still a work-in-progress, but its primary utilities are
threefold:

1. Validate that your note metadata looks the way you expect it to and report
   useful errors if something is missing or wrong.
2. Allow metadata values to be derived from other metadata using an extension of
   Dataview's expression language.
3. Automatically generate tags and links inside notes based on conditions
   specified through metadata declarations.

More capabilities will be added, even upon initial release, but those are the
big ones that will for sure be included.

The motivation for creating this plugin was the desire to conditionally update
metadata values based on the current state of other metadata values, and to then
be able to query and visualize different possible states of an Obsidian vault.

## Documentation

None yet. Features still being determined.

## Developmet

Use the following for development purposes:

- `pnpm dev`
- `pnpm test`
- `pnpm build`

The `pnpm` package is added as a dev dependency, so you can run `npm install` to
get it if you don't want to install it globally.
