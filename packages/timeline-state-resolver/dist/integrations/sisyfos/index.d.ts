import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, DeviceOptionsSisyfos, Mappings, SisyfosOptions, TSRTimelineContent, Timeline, SisyfosActions, ActionExecutionResult } from 'timeline-state-resolver-types';
import { SisyfosCommand, SisyfosState, SisyfosChannel } from './connection';
export interface DeviceOptionsSisyfosInternal extends DeviceOptionsSisyfos {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: SisyfosCommand, context: CommandContext, timelineObjId: string) => Promise<any>;
type CommandContext = string;
/**
 * This is a generic wrapper for any osc-enabled device.
 */
export declare class SisyfosMessageDevice extends DeviceWithState<SisyfosState, DeviceOptionsSisyfosInternal> {
    private _doOnTime;
    private _sisyfos;
    private _commandReceiver;
    private _resyncing;
    constructor(deviceId: string, deviceOptions: DeviceOptionsSisyfosInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: SisyfosOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Handles a new state such that the device will be in that state at a specific point
     * in time.
     * @param newState
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    private _handleStateInner;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    getStatus(): DeviceStatus;
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    private _makeReadyInner;
    executeAction(actionId: SisyfosActions, _payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    get canConnect(): boolean;
    get connected(): boolean;
    getDeviceState(isDefaultState?: boolean, mappings?: Mappings): SisyfosState;
    getDefaultStateChannel(): SisyfosChannel;
    /**
     * Transform the timeline state into a device state, which is in this case also
     * a timeline state.
     * @param state
     */
    convertStateToSisyfosState(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): SisyfosState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    /**
     * add the new commands to the queue:
     * @param commandsToAchieveState
     * @param time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    private _diffStates;
    private _defaultCommandReceiver;
    private _connectionChanged;
}
export {};
//# sourceMappingURL=index.d.ts.map