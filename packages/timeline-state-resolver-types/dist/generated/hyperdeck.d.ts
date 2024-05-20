/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run "yarn generate-schema-types" to regenerate this file.
 */
export interface HyperdeckOptions {
    host: string;
    port?: number;
    minRecordingTime?: number;
    /**
     * If true, no warnings will be emitted when storage slots are empty.
     */
    suppressEmptySlotWarnings?: boolean;
}
export interface MappingHyperdeckTransport {
    mappingType: MappingHyperdeckType.Transport;
}
export declare enum MappingHyperdeckType {
    Transport = "transport"
}
export type SomeMappingHyperdeck = MappingHyperdeckTransport;
export declare enum HyperdeckActions {
    FormatDisks = "formatDisks",
    Resync = "resync"
}
//# sourceMappingURL=hyperdeck.d.ts.map