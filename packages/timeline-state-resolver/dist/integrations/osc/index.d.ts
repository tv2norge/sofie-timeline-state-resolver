import { ActionExecutionResult, DeviceStatus, DeviceOptionsOSC, OSCMessageCommandContent, OSCOptions, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { Device } from '../../service/device';
import EventEmitter = require('eventemitter3');
export type OscDeviceOptions = OSCOptions;
export type DeviceOptionsOSCInternal = DeviceOptionsOSC;
export interface OscDeviceState {
    [address: string]: OSCDeviceStateContent;
}
interface OSCDeviceStateContent extends OSCMessageCommandContent {
    fromTlObject: string;
}
export interface OscCommandWithContext {
    command: any;
    context: string;
    tlObjId: string;
}
export declare class OscDevice extends EventEmitter implements Device<OSCOptions, OscDeviceState, OscCommandWithContext> {
    private _oscClient;
    private _oscClientStatus;
    private transitions;
    private transitionInterval;
    private options;
    init(options: OscDeviceOptions): Promise<boolean>;
    terminate(): Promise<boolean>;
    convertTimelineStateToDeviceState(state: Timeline.TimelineState<TSRTimelineContent>): OscDeviceState;
    diffStates(oldState: OscDeviceState | undefined, newState: OscDeviceState): Array<OscCommandWithContext>;
    sendCommand({ command, context, tlObjId }: OscCommandWithContext): Promise<any>;
    get connected(): boolean;
    getStatus(): Omit<DeviceStatus, 'active'>;
    actions: Record<string, (id: string, payload: Record<string, any>) => Promise<ActionExecutionResult>>;
    private _oscSender;
    private runAnimation;
    private getMonotonicTime;
}
export {};
//# sourceMappingURL=index.d.ts.map