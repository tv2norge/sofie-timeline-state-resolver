import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, SingularLiveOptions, DeviceOptionsSingularLive, SingularCompositionControlNode, Mappings, TSRTimelineContent, Timeline } from 'timeline-state-resolver-types';
export interface DeviceOptionsSingularLiveInternal extends DeviceOptionsSingularLive {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: SingularLiveCommandContent, context: CommandContext, timelineObjId: string) => Promise<any>;
export interface SingularLiveControlNodeCommandContent extends SingularLiveCommandContent {
    state?: string;
    payload?: {
        [controlNodeField: string]: string;
    };
}
export interface SingularLiveCommandContent {
    subCompositionName: string;
}
export type CommandContext = string;
export interface SingularComposition {
    timelineObjId: string;
    controlNode: SingularCompositionControlNode;
}
export interface SingularLiveState {
    compositions: {
        [key: string]: SingularComposition;
    };
}
/**
 * This is a Singular.Live device, it talks to a Singular.Live App Instance using an Access Token
 */
export declare class SingularLiveDevice extends DeviceWithState<SingularLiveState, DeviceOptionsSingularLiveInternal> {
    private _accessToken;
    private _doOnTime;
    private _deviceStatus;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsSingularLiveInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: SingularLiveOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    getStatus(): DeviceStatus;
    makeReady(_okToDestroyStuff?: boolean): Promise<void>;
    get canConnect(): boolean;
    get connected(): boolean;
    private _getDefaultState;
    convertStateToSingularLive(state: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): SingularLiveState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    private _diffStates;
    private _defaultCommandReceiver;
}
//# sourceMappingURL=index.d.ts.map