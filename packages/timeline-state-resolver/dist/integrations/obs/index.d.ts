import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, DeviceOptionsOBS, OBSOptions, Mappings, OBSRequest as OBSRequestName, TSRTimelineContent, Timeline } from 'timeline-state-resolver-types';
interface OBSRequest {
    requestName: OBSRequestName;
    args: object;
}
export interface DeviceOptionsOBSInternal extends DeviceOptionsOBS {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: OBSCommandWithContext, context: CommandContext, timelineObjId: string) => Promise<any>;
type CommandContext = any;
export interface OBSCommandWithContext {
    command: OBSRequest;
    context: CommandContext;
    timelineId: string;
}
/**
 * This is a OBSDevice, it sends commands when it feels like it
 */
export declare class OBSDevice extends DeviceWithState<OBSState, DeviceOptionsOBSInternal> {
    private _doOnTime;
    private _commandReceiver;
    private _obs;
    private _options;
    private _connected;
    private _authenticated;
    private _initialized;
    private _setDisconnected;
    private _retryConnectTimeout;
    constructor(deviceId: string, deviceOptions: DeviceOptionsOBSInternal, options: any);
    init(options: OBSOptions): Promise<boolean>;
    private _connect;
    private _connectionChanged;
    private _setConnected;
    private _triggerRetryConnection;
    private _retryConnection;
    private _getDefaultState;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    getStatus(): DeviceStatus;
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    get canConnect(): boolean;
    get connected(): boolean;
    convertStateToOBS(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): OBSState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    private _addToQueue;
    private _resolveCurrentSceneState;
    private _resolveCurrentTransitionState;
    private _resolveRecordingStreaming;
    private _resolveMute;
    private _resolveScenes;
    private _resolveSourceSettings;
    private _diffStates;
    private _defaultCommandReceiver;
}
interface OBSSceneItem {
    render: boolean;
}
interface OBSScene {
    sceneItems: {
        [key: string]: OBSSceneItem;
    };
}
export declare class OBSState {
    currentScene: string | undefined;
    previewScene: string | undefined;
    currentTransition: string | undefined;
    recording: boolean | undefined;
    streaming: boolean | undefined;
    muted: {
        [key: string]: boolean;
    };
    scenes: {
        [key: string]: OBSScene;
    };
    sources: {
        [key: string]: OBSSourceState;
    };
}
interface OBSSourceState {
    sourceType: string;
    sourceSettings: object;
}
export {};
//# sourceMappingURL=index.d.ts.map