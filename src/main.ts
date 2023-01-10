import { App, Modal, Plugin, PluginSettingTab, Setting } from "obsidian";
import { getAPI } from "obsidian-dataview";

import { Schema } from "./parser";

interface SchemaPluginSettings {
  validateInactiveNotes: boolean;
}

const DEFAULT_SETTINGS: SchemaPluginSettings = {
  validateInactiveNotes: false
};

export default class SchemaPlugin extends Plugin {
  settings: SchemaPluginSettings;

  async onload() {
    console.clear();

    await this.loadSettings();

    const dv = getAPI(this.app);
    if (!dv) {
      new Alert(this.app).open();
      return;
    }

    console.log(Schema.tryParse("").map((f) => `${f.name}:${f.value}`));

    this.addSettingTab(new SchemaSettingsTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class Alert extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText(
      "Plugin 'Dataview' is required for Schema to work. \
      Please install it and re-enable Schema."
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SchemaSettingsTab extends PluginSettingTab {
  plugin: SchemaPlugin;

  constructor(app: App, plugin: SchemaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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
          .setValue(this.plugin.settings.validateInactiveNotes)
          .onChange(async (value) => {
            this.plugin.settings.validateInactiveNotes = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
