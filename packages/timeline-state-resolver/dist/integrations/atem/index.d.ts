import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, AtemOptions, DeviceOptionsAtem, Mappings, Timeline, TSRTimelineContent, ActionExecutionResult, AtemActions } from 'timeline-state-resolver-types';
import { State as DeviceState } from 'atem-state';
import { Commands as AtemCommands } from 'atem-connection';
export interface AtemCommandWithContext {
    command: AtemCommands.ISerializableCommand;
    context: CommandContext;
    timelineObjId: string;
}
type CommandContext = any;
export interface DeviceOptionsAtemInternal extends DeviceOptionsAtem {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, command: AtemCommands.ISerializableCommand, context: CommandContext, timelineObjId: string) => Promise<any>;
/**
 * This is a wrapper for the Atem Device. Commands to any and all atem devices will be sent through here.
 */
export declare class AtemDevice extends DeviceWithState<DeviceState, DeviceOptionsAtemInternal> {
    private _doOnTime;
    private _atem;
    private _state;
    private _initialized;
    private _connected;
    private firstStateAfterMakeReady;
    private _atemStatus;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsAtemInternal, getCurrentTime: () => Promise<number>);
    /**
     * Initiates the connection with the ATEM through the atem-connection lib
     * and initiates Atem State lib.
     */
    init(options: AtemOptions): Promise<boolean>;
    /**
     * Safely terminate everything to do with this device such that it can be
     * garbage collected.
     */
    terminate(): Promise<boolean>;
    private resyncState;
    executeAction(actionId: AtemActions, _payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    /**
     * Prepare device for playout
     * @param okToDestroyStuff If true, may break output
     */
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Process a state, diff against previous state and generate commands to
     * be executed at the state's time.
     * @param newState The state to handle
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Clear any scheduled commands after `clearAfterTime`
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    get canConnect(): boolean;
    get connected(): boolean;
    /**
     * Convert a timeline state into an Atem state.
     * @param state The state to be converted
     */
    convertStateToAtem(state: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): DeviceState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    /**
     * Check status and return it with useful messages appended.
     */
    getStatus(): DeviceStatus;
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     * @param oldAtemState
     * @param newAtemState
     */
    private _diffStates;
    private _defaultCommandReceiver;
    private _onAtemStateChanged;
    private _connectionChanged;
    private _isAssignableToNextStyle;
}
export {};
//# sourceMappingURL=index.d.ts.map