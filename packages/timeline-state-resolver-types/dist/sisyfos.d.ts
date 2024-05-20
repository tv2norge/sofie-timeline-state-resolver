import { DeviceType } from '.';
export declare enum TimelineContentTypeSisyfos {
    CHANNEL = "channel",
    CHANNELS = "channels",
    TRIGGERVALUE = "triggerValue"
}
export type TimelineContentSisyfosAny = TimelineContentSisyfosChannel | TimelineContentSisyfosChannels | TimelineContentSisyfosTriggerValue;
export interface TimelineContentSisyfos {
    deviceType: DeviceType.SISYFOS;
    type: TimelineContentTypeSisyfos;
}
export interface SisyfosChannelOptions {
    isPgm?: 0 | 1 | 2;
    faderLevel?: number;
    label?: string;
    visible?: boolean;
    fadeTime?: number;
}
export interface TimelineContentSisyfosTriggerValue extends TimelineContentSisyfos {
    type: TimelineContentTypeSisyfos.TRIGGERVALUE;
    triggerValue: string;
}
export interface TimelineContentSisyfosChannel extends TimelineContentSisyfos, SisyfosChannelOptions {
    type: TimelineContentTypeSisyfos.CHANNEL;
    resync?: boolean;
    overridePriority?: number;
}
export interface TimelineContentSisyfosChannels extends TimelineContentSisyfos {
    type: TimelineContentTypeSisyfos.CHANNELS;
    channels: ({
        /** The mapping layer to look up the channel from */
        mappedLayer: string;
    } & SisyfosChannelOptions)[];
    resync?: boolean;
    overridePriority?: number;
    triggerValue?: string;
}
//# sourceMappingURL=sisyfos.d.ts.map