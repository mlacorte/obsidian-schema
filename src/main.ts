import { autorun, configure, observable, reaction, toJS } from "mobx";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

import { ObservableContext } from "./context";

export default class SchemaPlugin extends Plugin {
  context: ObservableContext = new ObservableContext();

  protected get plugins() {
    return (this.app as any).plugins;
  }

  protected get dataview() {
    return this.plugins.plugins["dataview"];
  }

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
    this.plugins.plugins = observable(
      this.plugins.plugins,
      {},
      { deep: false }
    );

    // watch plugins
    this.schemaDisposer = autorun(() => {
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

    // return dataview to its default state
    this.unloadDataview();

    // return plugins to its default state
    this.plugins.plugins = { ...this.plugins.plugins };
  }

  loadAndWatchDataviewSettings() {
    this.dataview.settings = observable(this.dataview.settings);
    this.context.linkDataviewSettings(this.dataview.settings);

    const onunloadDataview = this.dataview.onunload.bind(this.dataview);
    this.dataview.onunload = () => {
      this.unloadDataview();
      onunloadDataview();
    };
  }

  unloadDataview() {
    this.dataview.settings = toJS(this.dataview.settings);
    this.context.linkDataviewSettings();
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
