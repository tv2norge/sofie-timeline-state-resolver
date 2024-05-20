import { ThreadedClass, ThreadedClassConfig } from 'threadedclass';
import { DeviceType, DeviceOptionsBase } from 'timeline-state-resolver-types';
import { EventEmitter } from 'eventemitter3';
import { DeviceDetails, DeviceInstanceWrapper } from './DeviceInstance';
import { Device } from '../conductor';
export type DeviceContainerEvents = {
    error: [context: string, err: Error];
};
export declare abstract class BaseRemoteDeviceIntegration<TOptions extends DeviceOptionsBase<any>> extends EventEmitter<DeviceContainerEvents> {
    abstract onChildClose: () => void | undefined;
    protected abstract _device: ThreadedClass<DeviceInstanceWrapper> | ThreadedClass<Device<TOptions>>;
    protected _details: DeviceDetails;
    protected _onEventListeners: {
        stop: () => void;
    }[];
    private _debugLogging;
    private _debugState;
    private readonly _deviceOptions;
    private readonly _threadConfig;
    protected _initialized: boolean;
    constructor(deviceOptions: TOptions, threadConfig?: ThreadedClassConfig);
    get initialized(): boolean;
    abstract reloadProps(): Promise<void>;
    abstract init(_initOptions: TOptions['options'], activeRundownPlaylistId: string | undefined): Promise<boolean>;
    terminate(): Promise<void>;
    setDebugLogging(debug: boolean): Promise<void>;
    setDebugState(debug: boolean): Promise<void>;
    get device(): ThreadedClass<DeviceInstanceWrapper> | ThreadedClass<Device<TOptions>>;
    get deviceId(): string;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get deviceOptions(): TOptions;
    get threadConfig(): ThreadedClassConfig | undefined;
    get instanceId(): number;
    get startTime(): number;
    get debugLogging(): boolean;
    get debugState(): boolean;
    get details(): DeviceDetails;
}
/**
 * A device container is a wrapper around a device in ThreadedClass class, it
 * keeps a local property of some basic information about the device (like
 * names and id's) to prevent a costly round trip over IPC.
 */
export declare class RemoteDeviceInstance<TOptions extends DeviceOptionsBase<any>> extends BaseRemoteDeviceIntegration<TOptions> {
    protected _device: ThreadedClass<DeviceInstanceWrapper>;
    onChildClose: () => void | undefined;
    private constructor();
    static create<TOptions extends DeviceOptionsBase<unknown>, TCtor extends new (...args: any[]) => DeviceInstanceWrapper>(orgModule: string, orgClassExport: string, deviceId: string, deviceOptions: TOptions, getCurrentTime: () => number, threadConfig?: ThreadedClassConfig): Promise<RemoteDeviceInstance<TOptions>>;
    reloadProps(): Promise<void>;
    init(_initOptions: TOptions['options'], activeRundownPlaylistId: string | undefined): Promise<boolean>;
}
//# sourceMappingURL=remoteDeviceInstance.d.ts.map