import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, ShotokuCommandContent, ShotokuOptions, DeviceOptionsShotoku, Mappings, TimelineContentShotokuSequence, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { ShotokuCommand } from './connection';
export interface DeviceOptionsShotokuInternal extends DeviceOptionsShotoku {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: ShotokuCommand, context: CommandContext, timelineObjId: string) => Promise<any>;
type CommandContext = string;
type ShotokuDeviceState = {
    shots: Record<string, ShotokuCommandContent & {
        fromTlObject: string;
    }>;
    sequences: Record<string, ShotokuSequence>;
};
interface ShotokuSequence {
    fromTlObject: string;
    shots: TimelineContentShotokuSequence['shots'];
}
/**
 * This is a generic wrapper for any osc-enabled device.
 */
export declare class ShotokuDevice extends DeviceWithState<ShotokuDeviceState, DeviceOptionsShotokuInternal> {
    private _doOnTime;
    private _shotoku;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsShotokuInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: ShotokuOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Handles a new state such that the device will be in that state at a specific point
     * in time.
     * @param newState
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    getStatus(): DeviceStatus;
    makeReady(_okToDestroyStuff?: boolean): Promise<void>;
    get canConnect(): boolean;
    get connected(): boolean;
    /**
     * Transform the timeline state into a device state, which is in this case also
     * a timeline state.
     * @param state
     */
    convertStateToShotokuShots(state: Timeline.TimelineState<TSRTimelineContent>): ShotokuDeviceState;
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
     * @param oldState The assumed current state
     * @param newState The desired state of the device
     */
    private _diffStates;
    private _defaultCommandReceiver;
}
export {};
//# sourceMappingURL=index.d.ts.map