import { DeviceStatus, Device } from './../../devices/device';
import { DeviceType, HTTPWatcherOptions, DeviceOptionsHTTPWatcher, Mappings, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { Response } from 'got';
export type DeviceOptionsHTTPWatcherInternal = DeviceOptionsHTTPWatcher;
/**
 * This is a HTTPWatcherDevice, requests a uri on a regular interval and watches
 * it's response.
 */
export declare class HTTPWatcherDevice extends Device<DeviceOptionsHTTPWatcherInternal> {
    private uri?;
    private httpMethod;
    private expectedHttpResponse;
    private headers?;
    private keyword;
    private intervalTime;
    private interval;
    private status;
    private statusReason;
    constructor(deviceId: string, deviceOptions: DeviceOptionsHTTPWatcherInternal, getCurrentTime: () => Promise<number>);
    onInterval(): void;
    stopInterval(): void;
    startInterval(): void;
    handleResponse(response: Response<string>): void;
    init(_initOptions: HTTPWatcherOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(_newStateTime: number): void;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    clearFuture(_clearAfterTime: number): void;
    getStatus(): DeviceStatus;
    terminate(): Promise<boolean>;
    private _setStatus;
    get canConnect(): boolean;
    get connected(): boolean;
    get deviceType(): DeviceType;
    get deviceName(): string;
}
//# sourceMappingURL=index.d.ts.map