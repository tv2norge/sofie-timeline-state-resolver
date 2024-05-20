import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, QuantelOptions, DeviceOptionsQuantel, Mappings, Timeline, TSRTimelineContent, ActionExecutionResult } from 'timeline-state-resolver-types';
import { QuantelCommand, QuantelState, QuantelCommandType } from './types';
export { QuantelCommandType };
export interface DeviceOptionsQuantelInternal extends DeviceOptionsQuantel {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: QuantelCommand, context: string, timelineObjId: string) => Promise<any>;
/**
 * This class is used to interface with a Quantel-gateway,
 * https://github.com/nrkno/tv-automation-quantel-gateway
 *
 * This device behaves a little bit different than the others, because a play-command is
 * a two-step rocket.
 * This is why the commands generated by the state-diff is not one-to-one related to the
 * actual commands sent to the Quantel-gateway.
 */
export declare class QuantelDevice extends DeviceWithState<QuantelState, DeviceOptionsQuantelInternal> {
    private _quantel;
    private _quantelManager;
    private _commandReceiver;
    private _doOnTime;
    private _doOnTimeBurst;
    private _initOptions?;
    private _disconnectedSince;
    constructor(deviceId: string, deviceOptions: DeviceOptionsQuantelInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: QuantelOptions): Promise<boolean>;
    /**
     * Terminates the device safely such that things can be garbage collected.
     */
    terminate(): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Generates an array of Quantel commands by comparing the newState against the oldState, or the current device state.
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Attempts to restart the gateway
     */
    private restartGateway;
    executeAction(actionId: string, _payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    get canConnect(): boolean;
    get connected(): boolean;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    private _getMappedPorts;
    /**
     * Takes a timeline state and returns a Quantel State that will work with the state lib.
     * @param timelineState The timeline state to generate from.
     */
    convertStateToQuantel(timelineState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): QuantelState;
    /**
     * Prepares the physical device for playout.
     * @param okToDestroyStuff Whether it is OK to do things that affects playout visibly
     */
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
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
     * Sends commands to the Quantel ISA server
     * @param time deprecated
     * @param cmd Command to execute
     */
    private _defaultCommandReceiver;
    private _connectionChanged;
}
//# sourceMappingURL=index.d.ts.map