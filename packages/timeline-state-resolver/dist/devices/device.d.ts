import { Mappings, DeviceType, MediaObject, DeviceOptionsBase, DeviceStatus, StatusCode, Timeline, TSRTimelineContent, ActionExecutionResult } from 'timeline-state-resolver-types';
import { EventEmitter } from 'eventemitter3';
import { CommandReport, DoOnTime, SlowFulfilledCommandInfo, SlowSentCommandInfo } from './doOnTime';
import { ExpectedPlayoutItem } from '../expectedPlayoutItems';
import { FinishedTrace } from '../lib';
export interface DeviceCommand {
    time: number;
    deviceId: string;
    command: any;
}
export interface DeviceCommandContainer {
    deviceId: string;
    commands: Array<DeviceCommand>;
}
export interface CommandWithContext {
    context: any;
    timelineObjId: string;
    command: any;
}
export declare function literal<T>(o: T): T;
export { DeviceStatus, StatusCode };
export type DeviceEvents = {
    info: [info: string];
    warning: [warning: string];
    error: [context: string, err: Error];
    debug: [...debug: any[]];
    debugState: [state: object];
    /** The connection status has changed */
    connectionChanged: [status: DeviceStatus];
    /** A message to the resolver that something has happened that warrants a reset of the resolver (to re-run it again) */
    resetResolver: [];
    /** A report that a command was sent too late */
    slowCommand: [commandInfo: string];
    /** A report that a command was sent too late */
    slowSentCommand: [info: SlowSentCommandInfo];
    /** A report that a command was fullfilled too late */
    slowFulfilledCommand: [info: SlowFulfilledCommandInfo];
    /** Something went wrong when executing a command  */
    commandError: [error: Error, context: CommandWithContext];
    /** Update a MediaObject  */
    updateMediaObject: [collectionId: string, docId: string, doc: MediaObject | null];
    /** Clear a MediaObjects collection */
    clearMediaObjects: [collectionId: string];
    commandReport: [commandReport: CommandReport];
    timeTrace: [trace: FinishedTrace];
};
export interface IDevice<TOptions extends DeviceOptionsBase<any>> {
    init: (initOptions: TOptions['options'], activeRundownPlaylistId: string | undefined) => Promise<boolean>;
    getCurrentTime: () => number;
    prepareForHandleState: (newStateTime: number) => void;
    handleState: (newState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings) => void;
    clearFuture: (clearAfterTime: number) => void;
    canConnect: boolean;
    connected: boolean;
    makeReady: (_okToDestroyStuff?: boolean, activeRundownId?: string) => Promise<void>;
    standDown: (_okToDestroyStuff?: boolean) => Promise<void>;
    getStatus: () => DeviceStatus;
    deviceId: string;
    deviceName: string;
    deviceType: DeviceType;
    deviceOptions: TOptions;
    instanceId: number;
    startTime: number;
}
/**
 * Base class for all Devices to inherit from. Defines the API that the conductor
 * class will use.
 */
export declare abstract class Device<TOptions extends DeviceOptionsBase<any>> extends EventEmitter<DeviceEvents> implements IDevice<TOptions> {
    private _getCurrentTime;
    private _deviceId;
    private _currentTimeDiff;
    private _currentTimeUpdated;
    private _instanceId;
    private _startTime;
    useDirectTime: boolean;
    protected _deviceOptions: TOptions;
    protected _reportAllCommands: boolean;
    protected _isActive: boolean;
    private debugLogging;
    private debugState;
    constructor(deviceId: string, deviceOptions: TOptions, getCurrentTime: () => Promise<number>);
    /**
     * Connect to the device, resolve the promise when ready.
     * @param initOptions Device-specific options
     * @param activeRundownPlaylistId ID of active rundown playlist
     */
    abstract init(initOptions: TOptions['options'], activeRundownPlaylistId?: string): Promise<boolean>;
    terminate(): Promise<boolean>;
    getCurrentTime(): number;
    /** Called from Conductor when a new state is about to be handled soon */
    abstract prepareForHandleState(newStateTime: number): void;
    /** Called from Conductor when a new state is to be handled */
    abstract handleState(newState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): void;
    /** To be called by children first in .handleState */
    protected onHandleState(_newState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): void;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    abstract clearFuture(clearAfterTime: number): void;
    abstract get canConnect(): boolean;
    abstract get connected(): boolean;
    /**
     * The makeReady method could be triggered at a time before broadcast
     * Whenever we know that the user want's to make sure things are ready for broadcast
     * The exact implementation differ between different devices
     * @param okToDestroyStuff If true, the device may do things that might affect the output (temporarily)
     */
    makeReady(_okToDestroyStuff?: boolean, _activeRundownId?: string): Promise<void>;
    /**
     * The standDown event could be triggered at a time after broadcast
     * The exact implementation differ between different devices
     * @param okToDestroyStuff If true, the device may do things that might affect the output (temporarily)
     */
    standDown(_okToDestroyStuff?: boolean): Promise<void>;
    abstract getStatus(): DeviceStatus;
    setDebugLogging(debug: boolean): void;
    protected emitDebug(...args: any[]): void;
    setDebugState(debug: boolean): void;
    protected emitDebugState(state: object): void;
    get deviceId(): string;
    /**
     * A human-readable name for this device
     */
    abstract get deviceName(): string;
    abstract get deviceType(): DeviceType;
    get deviceOptions(): TOptions;
    get supportsExpectedPlayoutItems(): boolean;
    handleExpectedPlayoutItems(_expectedPlayoutItems: Array<ExpectedPlayoutItem>): void;
    get isActive(): boolean;
    executeAction(_actionId: string, _payload?: Record<string, any>): Promise<ActionExecutionResult>;
    private _updateCurrentTime;
    get instanceId(): number;
    get startTime(): number;
    protected handleDoOnTime(doOnTime: DoOnTime, deviceType: string): void;
    private updateIsActive;
}
/**
 * Basic class that devices with state tracking can inherit from. Defines some
 * extra convenience methods for tracking state while inheriting all other methods
 * from the Device class.
 */
export declare abstract class DeviceWithState<TState, TOptions extends DeviceOptionsBase<any>> extends Device<TOptions> {
    private _states;
    private _setStateCount;
    /**
     * Get the last known state before a point time. Useful for creating device
     * diffs.
     * @param time
     */
    protected getStateBefore(time: number): {
        state: TState;
        time: number;
    } | null;
    /**
     * Get the last known state at a point in time. Useful for creating device
     * diffs.
     *
     * @todo is this literally the same as "getStateBefore(time + 1)"?
     *
     * @param time
     */
    protected getState(time?: number): {
        state: TState;
        time: number;
    } | null;
    /**
     * Saves a state on a certain time point. Overwrites any previous state
     * saved at the same time. Removes any state after this time point.
     * @param state
     * @param time
     */
    protected setState(state: TState, time: number): void;
    /**
     * Sets a windows outside of which all states will be removed.
     * @param removeBeforeTime
     * @param removeAfterTime
     */
    protected cleanUpStates(removeBeforeTime: number, removeAfterTime: number): void;
    /**
     * Removes all states
     */
    protected clearStates(): void;
}
//# sourceMappingURL=device.d.ts.map