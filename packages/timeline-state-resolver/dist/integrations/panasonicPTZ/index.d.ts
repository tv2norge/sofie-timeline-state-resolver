import { DeviceWithState, DeviceStatus } from '../../devices/device';
import { DeviceType, TimelineContentTypePanasonicPtz, PanasonicPTZOptions, DeviceOptionsPanasonicPTZ, Mappings, TSRTimelineContent, Timeline } from 'timeline-state-resolver-types';
export interface DeviceOptionsPanasonicPTZInternal extends DeviceOptionsPanasonicPTZ {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: PanasonicPtzCommand, context: CommandContext, timelineObjId: string) => Promise<any>;
export interface PanasonicPtzState {
    speed?: {
        value: number;
        timelineObjId: string;
    };
    preset?: {
        value: number;
        timelineObjId: string;
    };
    zoomSpeed?: {
        value: number;
        timelineObjId: string;
    };
    zoom?: {
        value: number;
        timelineObjId: string;
    };
}
export interface PanasonicPtzCommand {
    type: TimelineContentTypePanasonicPtz;
    speed?: number;
    preset?: number;
    zoomSpeed?: number;
    zoom?: number;
}
export interface PanasonicPtzCommandWithContext {
    command: PanasonicPtzCommand;
    context: CommandContext;
    timelineObjId: string;
}
type CommandContext = any;
/**
 * A wrapper for panasonic ptz cameras. Maps timeline states to device states and
 * executes commands to achieve such states. Depends on PanasonicPTZAPI class for
 * connection with the physical device.
 */
export declare class PanasonicPtzDevice extends DeviceWithState<PanasonicPtzState, DeviceOptionsPanasonicPTZInternal> {
    private _doOnTime;
    private _device;
    private _connected;
    private _commandReceiver;
    private _pingInterval;
    constructor(deviceId: string, deviceOptions: DeviceOptionsPanasonicPTZInternal, getCurrentTime: () => Promise<number>);
    /**
     * Initiates the device: set up ping for connection logic.
     */
    init(_initOptions: PanasonicPTZOptions): Promise<boolean>;
    /**
     * Converts a timeline state into a device state.
     * @param state
     */
    convertStateToPtz(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): PanasonicPtzState;
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
    getStatus(): DeviceStatus;
    private _getDefaultState;
    private _defaultCommandReceiver;
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    private _diffStates;
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
    private _setConnected;
    private _connectionChanged;
    private getValue;
}
export {};
//# sourceMappingURL=index.d.ts.map