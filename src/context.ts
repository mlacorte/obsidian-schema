import { makeAutoObservable } from "mobx";
import {
  DataviewSettings,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_QUERY_SETTINGS
} from "obsidian-dataview";

export interface SchemaSettings {
  validateInactiveNotes: boolean;
}

export const DEFAULT_SCHEMA_SETTINGS: SchemaSettings = {
  validateInactiveNotes: false
};

export const DEFAULT_DATAVIEW_SETTINGS: DataviewSettings = {
  ...DEFAULT_QUERY_SETTINGS,
  ...DEFAULT_EXPORT_SETTINGS,
  ...{
    inlineQueryPrefix: "=",
    inlineJsQueryPrefix: "$=",
    inlineQueriesInCodeblocks: true,
    enableInlineDataview: true,
    enableDataviewJs: false,
    enableInlineDataviewJs: false,
    prettyRenderInlineFields: true,
    dataviewJsKeyword: "dataviewjs"
  }
};

export interface IContext {
  settings: {
    schema: SchemaSettings;
    dataview: DataviewSettings;
  };
}

export class ObservableContext implements IContext {
  settings = {
    schema: DEFAULT_SCHEMA_SETTINGS,
    dataview: DEFAULT_DATAVIEW_SETTINGS
  };

  constructor() {
    makeAutoObservable(this);
  }

  updateSchemaSettings(update: Partial<SchemaSettings> = {}) {
    Object.assign(this.settings.schema, update);
  }

  linkDataviewSettings(settings: DataviewSettings = DEFAULT_DATAVIEW_SETTINGS) {
    this.settings.dataview = settings;
  }
}
