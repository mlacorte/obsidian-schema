import "obsidian-dataview";

import { DataviewApi, DataviewSettings } from "obsidian-dataview";

declare module "obsidian" {
  interface App {
    plugins: {
      enabledPlugins: Set<string>;
      plugins: {
        dataview?: {
          settings?: DataviewSettings;
          api: DataviewApi;
          onunload(): void;
        };
      };
    };
  }

  interface Workspace {
    /** Sent to rendered dataview components to tell them to possibly refresh */
    on(
      name: "dataview:refresh-views",
      callback: () => void,
      ctx?: any
    ): EventRef;
  }
}

declare global {
  interface Window {
    DataviewAPI?: DataviewApi;
  }
}

declare module "obsidian-dataview" {
  const Widgets: typeof import("obsidian-dataview/lib/data-model/value").Widgets;
  type DataviewSettings =
    import("obsidian-dataview/lib/settings").DataviewSettings;
  const DEFAULT_QUERY_SETTINGS: typeof import("obsidian-dataview/lib/settings").DEFAULT_QUERY_SETTINGS;
  const DEFAULT_EXPORT_SETTINGS: typeof import("obsidian-dataview/lib/settings").DEFAULT_EXPORT_SETTINGS;
}
