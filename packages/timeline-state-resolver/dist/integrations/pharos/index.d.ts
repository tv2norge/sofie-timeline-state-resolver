import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, PharosOptions, DeviceOptionsPharos, Mappings, TSRTimelineContent, Timeline, ActionExecutionResult } from 'timeline-state-resolver-types';
export interface DeviceOptionsPharosInternal extends DeviceOptionsPharos {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: Command, context: CommandContext, timelineObjId: string) => Promise<any>;
export interface Command {
    content: CommandContent;
    context: CommandContext;
    timelineObjId: string;
}
type PharosState = Timeline.TimelineState<TSRTimelineContent>;
interface CommandContent {
    fcn: (...args: any[]) => Promise<any>;
    args: any[];
}
type CommandContext = string;
/**
 * This is a wrapper for a Pharos-devices,
 * https://www.pharoscontrols.com/downloads/documentation/application-notes/
 */
export declare class PharosDevice extends DeviceWithState<PharosState, DeviceOptionsPharosInternal> {
    private _doOnTime;
    private _pharos;
    private _pharosProjectInfo?;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsPharosInternal, getCurrentTime: () => Promise<number>);
    /**
     * Initiates the connection with Pharos through the PharosAPI.
     */
    init(initOptions: PharosOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Handles a new state such that the device will be in that state at a specific point
     * in time.
     * @param newState
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    get canConnect(): boolean;
    get connected(): boolean;
    convertStateToPharos(state: Timeline.TimelineState<TSRTimelineContent>): PharosState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    makeReady(_okToDestroyStuff?: boolean): Promise<void>;
    executeAction(actionId: string, _payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    getStatus(): DeviceStatus;
    /**
     * Add commands to queue, to be executed at the right time
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