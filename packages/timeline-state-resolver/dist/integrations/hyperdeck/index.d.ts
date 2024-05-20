import { DeviceWithState, DeviceStatus } from '../../devices/device';
import { DeviceType, HyperdeckOptions, DeviceOptionsHyperdeck, Mappings, TSRTimelineContent, Timeline } from 'timeline-state-resolver-types';
import { Commands as HyperdeckCommands, TransportStatus } from 'hyperdeck-connection';
import { ActionExecutionResult } from 'timeline-state-resolver-types';
export interface DeviceOptionsHyperdeckInternal extends DeviceOptionsHyperdeck {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, command: HyperdeckCommands.AbstractCommand, context: CommandContext, timelineObjId: string) => Promise<any>;
export interface HyperdeckCommandWithContext {
    command: HyperdeckCommands.AbstractCommand;
    context: CommandContext;
    timelineObjId: string;
}
export interface TransportInfoCommandResponseExt {
    status: TransportStatus;
    speed: number;
    singleClip: boolean;
    loop: boolean;
    clipId: number | null;
    recordFilename?: string;
}
export interface DeviceState {
    notify: HyperdeckCommands.NotifyCommandResponse;
    transport: TransportInfoCommandResponseExt;
    /** The timelineObject this state originates from */
    timelineObjId: string;
}
type CommandContext = any;
/**
 * This is a wrapper for the Hyperdeck Device. Commands to any and all hyperdeck devices will be sent through here.
 */
export declare class HyperdeckDevice extends DeviceWithState<DeviceState, DeviceOptionsHyperdeckInternal> {
    private _doOnTime;
    private _hyperdeck;
    private _initialized;
    private _connected;
    private _recordingTime;
    private _minRecordingTime;
    private _recTimePollTimer;
    private _slots;
    private _slotStatus;
    private _transportStatus;
    private _suppressEmptySlotWarnings;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsHyperdeckInternal, getCurrentTime: () => Promise<number>);
    /**
     * Initiates the connection with the Hyperdeck through the hyperdeck-connection lib.
     */
    init(initOptions: HyperdeckOptions): Promise<boolean>;
    /**
     * Makes this device ready for garbage collection.
     */
    terminate(): Promise<boolean>;
    private resync;
    /**
     * Prepares device for playout
     */
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    /**
     * Sends commands to the HyperDeck to format disks. Afterwards,
     * calls this._queryRecordingTime
     */
    private formatDisks;
    executeAction(actionId: string, _payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Saves and handles state at specified point in time such that the device will be in
     * that state at that time.
     * @param newState
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Clears any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    get canConnect(): boolean;
    get connected(): boolean;
    /**
     * Converts a timeline state to a device state.
     * @param state
     */
    convertStateToHyperdeck(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): DeviceState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    getStatus(): DeviceStatus;
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     * @param oldHyperdeckState The assumed current state
     * @param newHyperdeckState The desired state of the device
     */
    private _diffStates;
    /**
     * Gets the current state of the device
     */
    private _queryCurrentState;
    /**
     * Queries the recording time left in seconds of the device and mutates
     * this._recordingTime
     */
    private _queryRecordingTime;
    private _querySlotNumber;
    /**
     * Gets the default state of the device
     */
    private _getDefaultState;
    private _defaultCommandReceiver;
    private _connectionChanged;
}
export {};
//# sourceMappingURL=index.d.ts.map