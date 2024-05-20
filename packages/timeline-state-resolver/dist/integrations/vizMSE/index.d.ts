import { DeviceStatus, DeviceWithState } from './../../devices/device';
import { ActionExecutionResult, DeviceOptionsVizMSE, DeviceType, Mappings, Timeline, TSRTimelineContent, VizMSEOptions, VizResetPayload } from 'timeline-state-resolver-types';
import { ExpectedPlayoutItem } from '../../expectedPlayoutItems';
import { VizMSECommand, VizMSEState } from './types';
export interface DeviceOptionsVizMSEInternal extends DeviceOptionsVizMSE {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: VizMSECommand, context: string, timelineObjId: string) => Promise<any>;
/**
 * This class is used to interface with a vizRT Media Sequence Editor, through the v-connection library.
 * It features playing both "internal" graphics element and vizPilot elements.
 */
export declare class VizMSEDevice extends DeviceWithState<VizMSEState, DeviceOptionsVizMSEInternal> {
    private _vizMSE?;
    private _vizmseManager?;
    private _commandReceiver;
    private _doOnTime;
    private _doOnTimeBurst;
    private _initOptions?;
    private _vizMSEConnected;
    constructor(deviceId: string, deviceOptions: DeviceOptionsVizMSEInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: VizMSEOptions, activeRundownPlaylistId?: string): Promise<boolean>;
    /**
     * Terminates the device safely such that things can be garbage collected.
     */
    terminate(): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Generates an array of VizMSE commands by comparing the newState against the oldState, or the current device state.
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    get canConnect(): boolean;
    get connected(): boolean;
    activate(payload: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    purgeRundown(clearAll: boolean): Promise<void>;
    clearEngines(): Promise<void>;
    resetViz(payload: VizResetPayload): Promise<void>;
    executeAction(actionId: string, payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    get supportsExpectedPlayoutItems(): boolean;
    handleExpectedPlayoutItems(expectedPlayoutItems: Array<ExpectedPlayoutItem>): void;
    getCurrentState(): VizMSEState | undefined;
    connectionChanged(connected?: boolean): void;
    /**
     * Takes a timeline state and returns a VizMSE State that will work with the state lib.
     * @param timelineState The timeline state to generate from.
     */
    convertStateToVizMSE(timelineState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): VizMSEState;
    private _contentToStateLayer;
    /**
     * Prepares the physical device for playout.
     * @param okToDestroyStuff Whether it is OK to do things that affects playout visibly
     */
    makeReady(okToDestroyStuff?: boolean, activeRundownPlaylistId?: string): Promise<void>;
    executeStandDown(): Promise<ActionExecutionResult>;
    /**
     * The standDown event could be triggered at a time after broadcast
     * @param okToDestroyStuff If true, the device may do things that might affect the visible output
     */
    standDown(okToDestroyStuff?: boolean): Promise<void>;
    getStatus(): DeviceStatus;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    private _diffStates;
    private _doCommand;
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Sends commands to the VizMSE server
     * @param time deprecated
     * @param cmd Command to execute
     */
    private _defaultCommandReceiver;
    ignoreWaitsInTests(): void;
}
//# sourceMappingURL=index.d.ts.map