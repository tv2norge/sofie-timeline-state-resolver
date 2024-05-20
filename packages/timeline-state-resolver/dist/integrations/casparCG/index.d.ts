import { DeviceWithState, DeviceStatus } from '../../devices/device';
import { AMCPCommand } from 'casparcg-connection';
import { DeviceType, CasparCGOptions, DeviceOptionsCasparCG, Mappings, Timeline, TSRTimelineContent, ActionExecutionResult, CasparCGActions } from 'timeline-state-resolver-types';
import { State } from 'casparcg-state';
export interface DeviceOptionsCasparCGInternal extends DeviceOptionsCasparCG {
    commandReceiver?: CommandReceiver;
    /** Allow skipping the resync upon connection, for unit tests */
    skipVirginCheck?: boolean;
}
export type CommandReceiver = (time: number, cmd: AMCPCommand, context: string, timelineObjId: string) => Promise<any>;
/**
 * This class is used to interface with CasparCG installations. It creates
 * device states from timeline states and then diffs these states to generate
 * commands. It depends on the DoOnTime class to execute the commands timely or,
 * optionally, uses the CasparCG command scheduling features.
 */
export declare class CasparCGDevice extends DeviceWithState<State, DeviceOptionsCasparCGInternal> {
    private _ccg;
    private _commandReceiver;
    private _doOnTime;
    private initOptions?;
    private _connected;
    private _queueOverflow;
    private _transitionHandler;
    private _retryTimeout;
    private _retryTime;
    private _currentState;
    constructor(deviceId: string, deviceOptions: DeviceOptionsCasparCGInternal, getCurrentTime: () => Promise<number>);
    /**
     * Initiates the connection with CasparCG through the ccg-connection lib and
     * initializes CasparCG State library.
     */
    init(initOptions: CasparCGOptions): Promise<boolean>;
    /**
     * Terminates the device safely such that things can be garbage collected.
     */
    terminate(): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Generates an array of CasparCG commands by comparing the newState against the oldState, or the current device state.
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    get canConnect(): boolean;
    get connected(): boolean;
    get deviceType(): DeviceType;
    get deviceName(): string;
    private convertObjectToCasparState;
    /**
     * Takes a timeline state and returns a CasparCG State that will work with the state lib.
     * @param timelineState The timeline state to generate from.
     */
    convertStateToCaspar(timelineState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): State;
    /**
     * Prepares the physical device for playout. If amcp scheduling is used this
     * tries to sync the timecode. If {@code okToDestroyStuff === true} this clears
     * all channels and resets our states.
     * @param okToDestroyStuff Whether it is OK to restart the device
     */
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    private clearAllChannels;
    executeAction(id: CasparCGActions): Promise<ActionExecutionResult>;
    /**
     * Attemps to restart casparcg over the HTTP API provided by CasparCG launcher.
     */
    private restartCasparCG;
    getStatus(): DeviceStatus;
    /**
     * Use either AMCP Command Scheduling or the doOnTime to execute commands at
     * {@code time}.
     * @param commandsToAchieveState Commands to be added to queue
     * @param time Point in time to send commands at
     */
    private _addToQueue;
    /**
     * Sends a command over a casparcg-connection instance
     * @param time deprecated
     * @param cmd Command to execute
     */
    private _defaultCommandReceiver;
    private _changeTrackedStateFromCommand;
    /**
     * This function takes the current timeline-state, and diffs it with the known
     * CasparCG state. If any media has failed to load, it will create a diff with
     * the intended (timeline) state and that command will be executed.
     */
    private _assertIntendedState;
    private _connectionChanged;
}
//# sourceMappingURL=index.d.ts.map