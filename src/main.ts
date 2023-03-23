import { autorun, configure, observable, reaction, toJS } from "mobx";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DataviewSettings } from "obsidian-dataview";

import { ObservableContext } from "./context";

type DataviewPlugin = Exclude<App["plugins"]["plugins"]["dataview"], undefined>;
type LoadedDataviewPlugin = DataviewPlugin & { settings: DataviewSettings };

export default class SchemaPlugin extends Plugin {
  context: ObservableContext = new ObservableContext();

  private _schemaDisposer: (() => void)[] = [];
  private get schemaDisposer() {
    return () => {
      this._schemaDisposer.forEach((dispose) => dispose());
      this._schemaDisposer = [];
    };
  }
  private set schemaDisposer(dispose: () => void) {
    this._schemaDisposer.push(dispose);
  }

  async onload() {
    console.clear();

    // allow dataview to mutate its settings without mobx warnings
    configure({ enforceActions: "never" });

    // make plugins observable
    this.app.plugins.plugins = observable(
      this.app.plugins.plugins,
      {},
      { deep: false }
    );

    // watch plugins
    this.schemaDisposer = autorun(() => {
      const dataview = this.app.plugins.plugins["dataview"];

      if (dataview === undefined) {
        return;
      }

      // load dataview and start watching settings
      if (dataview.settings !== undefined) {
        this.loadAndWatchDataviewSettings(dataview as LoadedDataviewPlugin);
      } else {
        this.app.metadataCache.on("dataview:api-ready" as any, () => {
          this.loadAndWatchDataviewSettings(dataview as LoadedDataviewPlugin);
        });
      }
    });

    // load schema settings
    this.context.updateSchemaSettings(await this.loadData());

    // save schema settings on change
    this.schemaDisposer = reaction(
      () => toJS(this.context.settings.schema),
      async () => {
        await this.saveData(this.context.settings.schema);
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

    // if dataview is loaded
    const dataview = this.app.plugins.plugins["dataview"];
    if (dataview) {
      // return dataview to its default state
      this.unloadDataview(dataview);

      // return plugins to its default state
      this.app.plugins.plugins = { ...this.app.plugins.plugins };
    }
  }

  loadAndWatchDataviewSettings(dataview: LoadedDataviewPlugin) {
    dataview.settings = observable(dataview.settings);
    this.context.linkDataviewSettings(dataview.settings);

    const onunloadDataview = dataview.onunload.bind(dataview);
    dataview.onunload = () => {
      this.unloadDataview(dataview);
      onunloadDataview();
    };
  }

  unloadDataview(dataview: DataviewPlugin) {
    dataview.settings = toJS(dataview.settings);
    this.context.resetDataviewSettings();
  }
}

class SchemaSettingsTab extends PluginSettingTab {
  context: ObservableContext;

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
        toggle
          .setValue(this.context.settings.schema.validateInactiveNotes)
          .onChange((validateInactiveNotes) =>
            this.context.updateSchemaSettings({ validateInactiveNotes })
          )
      );
  }
}
