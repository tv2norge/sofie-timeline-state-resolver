import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, AbstractOptions, DeviceOptionsAbstract, Mappings, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { ActionExecutionResult } from 'timeline-state-resolver-types';
export interface Command {
    commandName: string;
    timelineObjId: string;
    content: CommandContent;
    context: CommandContext;
}
type CommandContent = any;
type CommandContext = string;
export interface DeviceOptionsAbstractInternal extends DeviceOptionsAbstract {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: Command, context: CommandContext, timelineObjId: string) => Promise<any>;
type AbstractState = Timeline.TimelineState<TSRTimelineContent>;
export declare class AbstractDevice extends DeviceWithState<AbstractState, DeviceOptionsAbstractInternal> {
    private _doOnTime;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsAbstractInternal, getCurrentTime: () => Promise<number>);
    executeAction(_actionId: string, _payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    /**
     * Initiates the connection with CasparCG through the ccg-connection lib.
     */
    init(_initOptions: AbstractOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Handle a new state, at the point in time specified
     * @param newState
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    /**
     * Dispose of the device so it can be garbage collected.
     */
    terminate(): Promise<boolean>;
    get canConnect(): boolean;
    get connected(): boolean;
    /**
     * converts the timeline state into something we can use
     * @param state
     */
    convertStateToAbstract(state: Timeline.TimelineState<TSRTimelineContent>): Timeline.TimelineState<TSRTimelineContent>;
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
     * @param oldAbstractState
     * @param newAbstractState
     */
    private _diffStates;
    private _defaultCommandReceiver;
}
export {};
//# sourceMappingURL=index.d.ts.map