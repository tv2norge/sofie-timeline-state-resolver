import { DeviceType } from 'timeline-state-resolver-types';
import { Device } from './device';
export interface DeviceEntry {
    deviceClass: new () => Device<any, any, any>;
    canConnect: boolean;
    deviceName: (deviceId: string, options: any) => string;
    executionMode: (options: any) => 'salvo' | 'sequential';
}
type ImplementedDeviceTypes = DeviceType.OSC | DeviceType.HTTPSEND;
export declare const DevicesDict: Record<ImplementedDeviceTypes, DeviceEntry>;
export {};
//# sourceMappingURL=devices.d.ts.map