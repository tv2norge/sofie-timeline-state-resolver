import EventEmitter = require('eventemitter3');
import { DeviceStatus, DeviceType, Mappings, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { DeviceEvents } from './device';
import { DeviceOptionsAnyInternal, ExpectedPlayoutItem } from '..';
type Config = DeviceOptionsAnyInternal;
export interface DeviceDetails {
    deviceId: string;
    deviceType: DeviceType;
    deviceName: string;
    instanceId: number;
    startTime: number;
    supportsExpectedPlayoutItems: boolean;
    canConnect: boolean;
}
/**
 * Top level container for setting up and interacting with any device integrations
 */
export declare class DeviceInstanceWrapper extends EventEmitter<DeviceEvents> {
    private config;
    getCurrentTime: () => Promise<number>;
    private _device;
    private _stateHandler;
    private _deviceId;
    private _deviceType;
    private _deviceName;
    private _instanceId;
    private _startTime;
    private _isActive;
    private _logDebug;
    private _logDebugStates;
    constructor(id: string, time: number, config: Config, getCurrentTime: () => Promise<number>);
    initDevice(_activeRundownPlaylistId?: string): Promise<boolean>;
    terminate(): Promise<boolean>;
    executeAction(id: string, payload?: Record<string, any>): Promise<import("timeline-state-resolver-types").ActionExecutionResult>;
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    standDown(): Promise<void>;
    /** @deprecated - just here for API compatiblity with the old class */
    prepareForHandleState(): void;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    clearFuture(t: number): void;
    getDetails(): DeviceDetails;
    handleExpectedPlayoutItems(_expectedPlayoutItems: Array<ExpectedPlayoutItem>): void;
    getStatus(): DeviceStatus;
    setDebugLogging(value: boolean): void;
    setDebugState(value: boolean): void;
    private _setupDeviceEventHandlers;
}
export {};
//# sourceMappingURL=DeviceInstance.d.ts.map