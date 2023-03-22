import "obsidian-dataview";

declare module "obsidian-dataview" {
  const Widgets: typeof import("obsidian-dataview/lib/data-model/value").Widgets;
  type DataviewSettings =
    import("obsidian-dataview/lib/settings").DataviewSettings;
  const DEFAULT_QUERY_SETTINGS: typeof import("obsidian-dataview/lib/settings").DEFAULT_QUERY_SETTINGS;
  const DEFAULT_EXPORT_SETTINGS: typeof import("obsidian-dataview/lib/settings").DEFAULT_EXPORT_SETTINGS;
}
