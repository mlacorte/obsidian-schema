import {
  autorun,
  configure,
  observable,
  reaction,
  runInAction,
  toJS
} from "mobx";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

import {
  DEFAULT_DATAVIEW_SETTINGS,
  DEFAULT_SCHEMA_SETTINGS,
  ObservableContext
} from "./context";

export default class SchemaPlugin extends Plugin {
  context: ObservableContext = new ObservableContext();

  protected get settings() {
    return this.context.settings;
  }

  protected get appPlugins() {
    return (this.app as any).plugins;
  }

  protected get dataview() {
    return this.appPlugins.plugins["dataview"];
  }

  private onPluginChangeDisposer: () => void = () => undefined;

  private schemaDisposers: (() => void)[] = [];
  private get schemaDisposer() {
    return () => {
      this.schemaDisposers.forEach((dispose) => dispose());
      this.schemaDisposers = [];
    };
  }
  private set schemaDisposer(dispose: () => void) {
    this.schemaDisposers.push(dispose);
  }

  async onload() {
    console.clear();

    // allow dataview to mutate its settings without mobx warnings
    configure({ enforceActions: "never" });

    // make plugins observable
    this.appPlugins.plugins = observable(
      this.appPlugins.plugins,
      {},
      { deep: false }
    );

    // watch plugins
    this.onPluginChangeDisposer = autorun(() => {
      if (!this.dataview) {
        return;
      }

      // load dataview and start watching settings
      if (this.dataview.settings) {
        this.loadAndWatchDataviewSettings();
      } else {
        this.app.metadataCache.on("dataview:api-ready" as any, () => {
          this.loadAndWatchDataviewSettings();
        });
      }
    });

    // load schema settings
    await runInAction(async () => {
      this.settings.schema = Object.assign(
        {},
        DEFAULT_SCHEMA_SETTINGS,
        await this.loadData()
      );
    });

    // save schema settings on change
    this.schemaDisposer = reaction(
      () => Object.values(this.settings.schema),
      () => {
        this.saveData(this.settings.schema);
      }
    );

    // add settings page
    this.addSettingTab(new SchemaSettingsTab(this.app, this));
  }

  onunload() {
    // return mobx to default configuration
    configure({ enforceActions: "observed" });

    // stop watchers
    this.schemaDisposer();
    this.onPluginChangeDisposer();

    // return dataview to its default state
    this.unloadDataview();

    // return plugins to its default state
    this.appPlugins.plugins = { ...this.appPlugins.plugins };
  }

  loadAndWatchDataviewSettings() {
    this.dataview.settings = observable(this.dataview.settings);

    runInAction(() => {
      this.settings.dataview = this.dataview.settings;
    });

    const onunloadDataview = this.dataview.onunload.bind(this.dataview);
    this.dataview.onunload = () => {
      this.unloadDataview();
      onunloadDataview();
    };
  }

  unloadDataview() {
    this.dataview.settings = toJS(this.dataview.settings);

    runInAction(() => {
      this.settings.dataview = DEFAULT_DATAVIEW_SETTINGS;
    });
  }
}

class SchemaSettingsTab extends PluginSettingTab {
  context: ObservableContext;

  get settings() {
    return this.context.settings.schema;
  }

  constructor(app: App, plugin: SchemaPlugin) {
    super(app, plugin);
    this.context = plugin.context;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Schema Settings" });

    new Setting(containerEl)
      .setName("Validate Inactive Notes")
      .setDesc(
        "By default, Schema only validates actively loaded notes. Enabling \
        this setting will change that behavior to validate all notes in the \
        vault, even unloaded ones. This will provide more complete error \
        information at the expense of reduced performance in large vaults."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.settings.validateInactiveNotes).onChange((value) =>
          runInAction(() => {
            this.settings.validateInactiveNotes = value;
          })
        )
      );
  }
}
