import { DeviceWithState, DeviceStatus } from '../../devices/device';
import { DeviceType, SofieChefOptions, DeviceOptionsSofieChef, Mappings, SomeMappingSofieChef, TSRTimelineContent, Timeline, ActionExecutionResult, SofieChefActions } from 'timeline-state-resolver-types';
import { ReceiveWSMessageAny } from './api';
export interface DeviceOptionsSofieChefInternal extends DeviceOptionsSofieChef {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: Command, context: CommandContext, timelineObjId: string) => Promise<any>;
export interface Command {
    content: CommandContent;
    context: CommandContext;
    timelineObjId: string;
}
export interface SofieChefState {
    windows: {
        [windowId: string]: {
            url: string;
            /** The TimelineObject which set the url */
            urlTimelineObjId: string;
        };
    };
}
type CommandContent = ReceiveWSMessageAny;
type CommandContext = string;
/**
 * This is a wrapper for a SofieChef-devices,
 * https://github.com/nrkno/sofie-chef
 */
export declare class SofieChefDevice extends DeviceWithState<SofieChefState, DeviceOptionsSofieChefInternal> {
    private _doOnTime;
    private _ws?;
    private _connected;
    private _status;
    private initOptions?;
    private msgId;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsSofieChefInternal, getCurrentTime: () => Promise<number>);
    /**
     * Initiates the connection with SofieChed through a websocket connection.
     */
    init(initOptions: SofieChefOptions): Promise<boolean>;
    private _setupWSConnection;
    private reconnectTimeout?;
    private tryReconnect;
    private resyncState;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    /**
     * Handles a new state such that the device will be in that state at a specific point
     * in time.
     * @param newState
     */
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings<SomeMappingSofieChef>): void;
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    get canConnect(): boolean;
    get connected(): boolean;
    convertStateToSofieChef(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings<SomeMappingSofieChef>): SofieChefState;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    makeReady(_okToDestroyStuff?: boolean): Promise<void>;
    /** Restart (reload) all windows */
    private restartAllWindows;
    /** Restart (reload) a window */
    private restartWindow;
    executeAction(actionId: SofieChefActions, payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    getStatus(): DeviceStatus;
    private convertStatusCode;
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    private _diffStates;
    private _defaultCommandReceiver;
    private _updateConnected;
    private _updateStatus;
    private _handleReceivedMessage;
    private waitingForReplies;
    private _sendMessage;
}
export {};
//# sourceMappingURL=index.d.ts.map