import "obsidian-dataview/lib/typings/workers";

declare module "obsidian" {
  interface MetadataCache {
    trigger(...args: Parameters<MetadataCache["on"]>): void;
    trigger(name: string, ...data: any[]): void;
  }
}
