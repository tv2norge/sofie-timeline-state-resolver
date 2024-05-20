import { DeviceType, TSRActionSchema } from 'timeline-state-resolver-types';
export type TSRDevicesManifestEntry = {
    displayName: string;
    configSchema: string;
    actions?: TSRActionSchema[];
    mappingsSchemas: Record<string, string>;
};
export type TSRDevicesManifest = {
    [deviceType in DeviceType]: TSRDevicesManifestEntry;
};
export interface TSRManifest {
    commonOptions: string;
    subdevices: TSRDevicesManifest;
}
export declare const manifest: TSRManifest;
//# sourceMappingURL=manifest.d.ts.map