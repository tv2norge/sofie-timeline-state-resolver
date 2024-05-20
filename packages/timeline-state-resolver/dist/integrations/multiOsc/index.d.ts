import { DeviceWithState, DeviceStatus } from '../../devices/device';
import { DeviceType, OSCMessageCommandContent, Mappings, Timeline, TSRTimelineContent, DeviceOptionsMultiOSC, MultiOSCOptions } from 'timeline-state-resolver-types';
import * as osc from 'osc';
export interface DeviceOptionsMultiOSCInternal extends DeviceOptionsMultiOSC {
    oscSenders?: Record<string, (msg: osc.OscMessage, address?: string | undefined, port?: number | undefined) => void>;
}
export type CommandReceiver = (time: number, cmd: OSCMessageCommandContent, context: CommandContext, timelineObjId: string) => Promise<any>;
type CommandContext = string;
interface OSCDeviceState {
    [connectionId: string]: {
        [address: string]: OSCDeviceStateContent;
    };
}
interface OSCDeviceStateContent extends OSCMessageCommandContent {
    connectionId: string;
    fromTlObject: string;
}
/**
 * This is a generic wrapper for any osc-enabled device.
 */
export declare class MultiOSCMessageDevice extends DeviceWithState<OSCDeviceState, DeviceOptionsMultiOSCInternal> {
    private _doOnTime;
    private _connections;
    private _commandQueue;
    private _commandQueueTimer;
    constructor(deviceId: string, deviceOptions: DeviceOptionsMultiOSCInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: MultiOSCOptions): Promise<boolean>;
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
    convertStateToOSCMessage(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): OSCDeviceState;
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
     * @param oldOscSendState The assumed current state
     * @param newOscSendState The desired state of the device
     */
    private _diffStates;
    private _addAndProcessQueue;
    private _processQueue;
}
export {};
//# sourceMappingURL=index.d.ts.map