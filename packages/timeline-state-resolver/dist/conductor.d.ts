/// <reference types="node" />
import { EventEmitter } from 'eventemitter3';
import { MemUsageReport } from 'threadedclass';
import { Mappings, DeviceOptionsBase, Datastore, DeviceOptionsTelemetrics, TSRTimeline, DeviceOptionsMultiOSC, DeviceOptionsHTTPSend } from 'timeline-state-resolver-types';
import { FinishedTrace } from './lib';
import { CommandWithContext } from './devices/device';
import { DeviceContainer } from './devices/deviceContainer';
import { DeviceOptionsCasparCGInternal } from './integrations/casparCG';
import { DeviceOptionsAbstractInternal } from './integrations/abstract';
import { DeviceOptionsAtemInternal } from './integrations/atem';
import { DeviceOptionsLawoInternal } from './integrations/lawo';
import { DeviceOptionsPanasonicPTZInternal } from './integrations/panasonicPTZ';
import { DeviceOptionsHyperdeckInternal } from './integrations/hyperdeck';
import { DeviceOptionsTCPSendInternal } from './integrations/tcpSend';
import { DeviceOptionsPharosInternal } from './integrations/pharos';
import { DeviceOptionsOSCInternal } from './integrations/osc';
import { DeviceOptionsHTTPWatcherInternal } from './integrations/httpWatcher';
import { DeviceOptionsQuantelInternal } from './integrations/quantel';
import { DeviceOptionsSisyfosInternal } from './integrations/sisyfos';
import { DeviceOptionsSingularLiveInternal } from './integrations/singularLive';
import { DeviceOptionsVMixInternal } from './integrations/vmix';
import { DeviceOptionsOBSInternal } from './integrations/obs';
import { DeviceOptionsVizMSEInternal } from './integrations/vizMSE';
import { DeviceOptionsShotokuInternal } from './integrations/shotoku';
import { DeviceOptionsSofieChefInternal } from './integrations/sofieChef';
import { DeviceOptionsTriCasterInternal } from './integrations/tricaster';
import { DeviceOptionsMultiOSCInternal } from './integrations/multiOsc';
import { BaseRemoteDeviceIntegration } from './service/remoteDeviceInstance';
export { DeviceContainer };
export { CommandWithContext };
export declare const LOOKAHEADTIME = 5000;
export declare const PREPARETIME = 2000;
export declare const MINTRIGGERTIME = 10;
export declare const MINTIMEUNIT = 1;
export type TimelineTriggerTimeResult = Array<{
    id: string;
    time: number;
}>;
export { Device } from './devices/device';
export interface ConductorOptions {
    getCurrentTime?: () => number;
    autoInit?: boolean;
    multiThreadedResolver?: boolean;
    useCacheWhenResolving?: boolean;
    /** When set, some optimizations are made, intended to only run in production */
    optimizeForProduction?: boolean;
    /** When set, resolving is done early, to account for the time it takes to resolve the timeline. */
    proActiveResolve?: boolean;
    /** If set, multiplies the estimated resolve time (default: 1) */
    estimateResolveTimeMultiplier?: number;
}
export interface StatReport {
    reason?: string;
    timelineStartResolve: number;
    timelineResolved: number;
    stateHandled: number;
    done: number;
    timelineSize: number;
    timelineSizeOld: number;
    estimatedResolveTime: number;
}
export type ConductorEvents = {
    error: [...args: any[]];
    debug: [...args: any[]];
    debugState: [...args: any[]];
    info: [...args: any[]];
    warning: [...args: any[]];
    setTimelineTriggerTime: [r: TimelineTriggerTimeResult];
    timelineCallback: [time: number, instanceId: string, callback: string, callbackData: any];
    resolveDone: [timelineHash: string, duration: number];
    statReport: [report: StatReport];
    timeTrace: [trace: FinishedTrace];
};
export declare class AbortError extends Error {
    name: string;
}
/**
 * The Conductor class serves as the main class for interacting. It contains
 * methods for setting mappings, timelines and adding/removing devices. It keeps
 * track of when to resolve the timeline and updates the devices with new states.
 */
export declare class Conductor extends EventEmitter<ConductorEvents> {
    private _logDebug;
    private _timeline;
    private _timelineSize;
    private _mappings;
    private _datastore;
    private _deviceStates;
    private _options;
    private devices;
    private _getCurrentTime?;
    private _nextResolveTime;
    private _resolvedStates;
    private _resolveTimelineTrigger;
    private _isInitialized;
    private _doOnTime;
    private _multiThreadedResolver;
    private _useCacheWhenResolving;
    private _estimateResolveTimeMultiplier;
    private _callbackInstances;
    private _triggerSendStartStopCallbacksTimeout;
    private _sentCallbacks;
    private _actionQueue;
    private _statMeasureStart;
    private _statMeasureReason;
    private _statReports;
    private _resolver;
    private _interval;
    private _timelineHash;
    private activationId;
    constructor(options?: ConductorOptions);
    /**
     * Initializates the resolver, with optional multithreading
     */
    init(): Promise<void>;
    /**
     * Returns a nice, synchronized time.
     */
    getCurrentTime(): number;
    /**
     * Returns the mappings
     */
    get mapping(): Mappings;
    /**
     * Returns the current timeline
     */
    get timeline(): TSRTimeline;
    /**
     * Sets a new timeline and resets the resolver.
     */
    setTimelineAndMappings(timeline: TSRTimeline, mappings?: Mappings): void;
    get timelineHash(): string | undefined;
    set timelineHash(hash: string | undefined);
    get logDebug(): boolean;
    set logDebug(val: boolean);
    get estimateResolveTimeMultiplier(): number;
    set estimateResolveTimeMultiplier(value: number);
    getDevices(includeUninitialized?: boolean): Array<BaseRemoteDeviceIntegration<DeviceOptionsBase<any>>>;
    getDevice(deviceId: string, includeUninitialized?: boolean): BaseRemoteDeviceIntegration<DeviceOptionsBase<any>> | undefined;
    /**
     * Adds a device that can be referenced by the timeline and mappings.
     * NOTE: use this with caution! if a device fails to initialise (i.e. because the hardware is turned off) this may never resolve. It is preferred to use createDevice and initDevice separately for this reason.
     * @param deviceId Id used by the mappings to reference the device.
     * @param deviceOptions The options used to initalize the device
     * @returns A promise that resolves with the created device, or rejects with an error message.
     */
    addDevice(deviceId: string, deviceOptions: DeviceOptionsAnyInternal, activeRundownPlaylistId?: string): Promise<BaseRemoteDeviceIntegration<DeviceOptionsBase<any>>>;
    /**
     * Creates an uninitialised device that can be referenced by the timeline and mappings.
     * @param deviceId Id used by the mappings to reference the device.
     * @param deviceOptions The options used to initalize the device
     * @param options Additional options
     * @returns A promise that resolves with the created device, or rejects with an error message.
     */
    createDevice(deviceId: string, deviceOptions: DeviceOptionsAnyInternal, options?: {
        signal?: AbortSignal;
    }): Promise<BaseRemoteDeviceIntegration<DeviceOptionsBase<any>>>;
    private throwIfAborted;
    private createDeviceContainer;
    private terminateUnwantedDevice;
    /**
     * Initialises an existing device that can be referenced by the timeline and mappings.
     * @param deviceId Id used by the mappings to reference the device.
     * @param deviceOptions The options used to initalize the device
     * @param activeRundownPlaylistId Id of the current rundown playlist
     * @param options Additional options
     * @returns A promise that resolves with the initialised device, or rejects with an error message.
     */
    initDevice(deviceId: string, deviceOptions: DeviceOptionsAnyInternal, activeRundownPlaylistId?: string, options?: {
        signal?: AbortSignal;
    }): Promise<BaseRemoteDeviceIntegration<DeviceOptionsBase<any>>>;
    /**
     * Safely remove a device
     * @param deviceId The id of the device to be removed
     */
    removeDevice(deviceId: string): Promise<void>;
    /**
     * Remove all devices
     */
    destroy(): Promise<void>;
    /**
     * Resets the resolve-time, so that the resolving will happen for the point-in time NOW
     * next time
     */
    resetResolver(): void;
    /**
     * Send a makeReady-trigger to all devices
     *
     * @deprecated replace by TSR actions
     */
    devicesMakeReady(okToDestroyStuff?: boolean, activationId?: string): Promise<void>;
    /**
     * Send a standDown-trigger to all devices
     *
     * @deprecated replaced by TSR actions
     */
    devicesStandDown(okToDestroyStuff?: boolean): Promise<void>;
    getThreadsMemoryUsage(): Promise<{
        [childId: string]: MemUsageReport;
    }>;
    private _mapAllDevices;
    /**
     * This is the main resolve-loop.
     */
    private _triggerResolveTimeline;
    /**
     * Resolves the timeline for the next resolve-time, generates the commands and passes on the commands.
     */
    private _resolveTimeline;
    private _resolveTimelineInner;
    private _setDeviceState;
    setDatastore(newStore: Datastore): void;
    getTimelineSize(): number;
    private getTimelineSizeInner;
    /**
     * Returns a time estimate for the resolval duration based on the amount of
     * objects on the timeline. If the proActiveResolve option is falsy this
     * returns 0.
     */
    estimateResolveTime(): number;
    /** Calculates the estimated time it'll take to resolve a timeline of a certain size */
    static calculateResolveTime(timelineSize: number, multiplier: number): number;
    private _diffStateForCallbacks;
    private _queueCallback;
    private _triggerSendStartStopCallbacks;
    private _sendStartStopCallbacks;
    private statStartMeasure;
    private statReport;
    /**
     * Split the state into substates that are relevant for each device
     */
    private filterLayersPerDevice;
    /**
     * Only emits the event when there is an active rundownPlaylist.
     * This is used to reduce unnesessary logging
     */
    private emitWhenActive;
}
export type DeviceOptionsAnyInternal = DeviceOptionsAbstractInternal | DeviceOptionsCasparCGInternal | DeviceOptionsAtemInternal | DeviceOptionsLawoInternal | DeviceOptionsHTTPSend | DeviceOptionsHTTPWatcherInternal | DeviceOptionsPanasonicPTZInternal | DeviceOptionsTCPSendInternal | DeviceOptionsHyperdeckInternal | DeviceOptionsPharosInternal | DeviceOptionsOBSInternal | DeviceOptionsOSCInternal | DeviceOptionsMultiOSCInternal | DeviceOptionsSisyfosInternal | DeviceOptionsSofieChefInternal | DeviceOptionsQuantelInternal | DeviceOptionsSingularLiveInternal | DeviceOptionsVMixInternal | DeviceOptionsShotokuInternal | DeviceOptionsVizMSEInternal | DeviceOptionsTelemetrics | DeviceOptionsTriCasterInternal | DeviceOptionsMultiOSC;
//# sourceMappingURL=conductor.d.ts.map