import "obsidian-dataview/lib/typings/workers";

// https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
type OverloadProps<TOverload> = Pick<TOverload, keyof TOverload>;
type OverloadUnionRecursive<
  TOverload,
  TPartialOverload = unknown
> = TOverload extends (...args: infer TArgs) => infer TReturn
  ? TPartialOverload extends TOverload
    ? never
    :
        | OverloadUnionRecursive<
            TPartialOverload & TOverload,
            TPartialOverload &
              ((...args: TArgs) => TReturn) &
              OverloadProps<TOverload>
          >
        | ((...args: TArgs) => TReturn)
  : never;
type OverloadUnion<TOverload extends (...args: any[]) => any> = Exclude<
  OverloadUnionRecursive<(() => never) & TOverload>,
  TOverload extends () => never ? never : () => never
>;

declare module "obsidian" {
  interface MetadataCache {
    on(name: "dataview:index-ready", callback: () => any): EventRef;
    on(
      name: "dataview:metadata-change",
      callback: <T extends "update" | "delete" | "rename">(
        type: T,
        file: TFile,
        oldPath: T extends "rename" ? string : undefined
      ) => any
    ): EventRef;

    trigger(...args: Parameters<OverloadUnion<MetadataCache["on"]>>): void;
  }
}
