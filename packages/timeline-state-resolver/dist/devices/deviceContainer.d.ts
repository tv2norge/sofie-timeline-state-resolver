import { ThreadedClass, ThreadedClassConfig } from 'threadedclass';
import { Device } from './device';
import { DeviceOptionsBase } from 'timeline-state-resolver-types';
import { BaseRemoteDeviceIntegration, DeviceContainerEvents } from '../service/remoteDeviceInstance';
export { DeviceContainerEvents };
/**
 * A device container is a wrapper around a device in ThreadedClass class, it
 * keeps a local property of some basic information about the device (like
 * names and id's) to prevent a costly round trip over IPC.
 */
export declare class DeviceContainer<TOptions extends DeviceOptionsBase<any>> extends BaseRemoteDeviceIntegration<TOptions> {
    protected _device: ThreadedClass<Device<TOptions>>;
    onChildClose: () => void | undefined;
    private constructor();
    static create<TOptions extends DeviceOptionsBase<unknown>, TCtor extends new (...args: any[]) => Device<TOptions>>(orgModule: string, orgClassExport: string, deviceId: string, deviceOptions: TOptions, getCurrentTime: () => number, threadConfig?: ThreadedClassConfig): Promise<DeviceContainer<TOptions>>;
    reloadProps(): Promise<void>;
    init(initOptions: TOptions['options'], activeRundownPlaylistId: string | undefined): Promise<boolean>;
}
//# sourceMappingURL=deviceContainer.d.ts.map