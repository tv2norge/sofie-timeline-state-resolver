/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run "yarn generate-schema-types" to regenerate this file.
 */
export interface SisyfosOptions {
    host: string;
    port: number;
}
export interface MappingSisyfosChannel {
    channel: number;
    setLabelToLayerName?: boolean;
    mappingType: MappingSisyfosType.Channel;
}
export interface MappingSisyfosChannelByLabel {
    label: string;
    mappingType: MappingSisyfosType.ChannelByLabel;
}
export interface MappingSisyfosChannels {
    mappingType: MappingSisyfosType.Channels;
}
export declare enum MappingSisyfosType {
    Channel = "channel",
    ChannelByLabel = "channel_by_label",
    Channels = "channels"
}
export type SomeMappingSisyfos = MappingSisyfosChannel | MappingSisyfosChannelByLabel | MappingSisyfosChannels;
export declare enum SisyfosActions {
    Reinit = "reinit"
}
//# sourceMappingURL=sisyfos.d.ts.map