import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, TCPSendOptions, TcpSendCommandContent, DeviceOptionsTCPSend, Mappings, TSRTimelineContent, Timeline, ActionExecutionResult, TcpSendActions } from 'timeline-state-resolver-types';
export interface DeviceOptionsTCPSendInternal extends DeviceOptionsTCPSend {
    commandReceiver?: CommandReceiver;
}
export type CommandReceiver = (time: number, cmd: TcpSendCommandContent, context: CommandContext, timelineObjId: string) => Promise<any>;
type CommandContext = string;
type TSCSendState = Timeline.TimelineState<TSRTimelineContent>;
/**
 * This is a TCPSendDevice, it sends commands over tcp when it feels like it
 */
export declare class TCPSendDevice extends DeviceWithState<TSCSendState, DeviceOptionsTCPSendInternal> {
    private _makeReadyCommands;
    private _makeReadyDoesReset;
    private _doOnTime;
    private _tcpClient;
    private _connected;
    private _host;
    private _port;
    private _bufferEncoding?;
    private _setDisconnected;
    private _retryConnectTimeout;
    private _commandReceiver;
    constructor(deviceId: string, deviceOptions: DeviceOptionsTCPSendInternal, getCurrentTime: () => Promise<number>);
    init(initOptions: TCPSendOptions): Promise<boolean>;
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime: number): void;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    clearFuture(clearAfterTime: number): void;
    private reconnect;
    private resetState;
    private sendCommand;
    executeAction(actionId: TcpSendActions, payload?: Record<string, any> | undefined): Promise<ActionExecutionResult>;
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    terminate(): Promise<boolean>;
    get canConnect(): boolean;
    get connected(): boolean;
    convertStateToTCPSend(state: Timeline.TimelineState<TSRTimelineContent>): Timeline.TimelineState<TSRTimelineContent>;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    getStatus(): DeviceStatus;
    private _setConnected;
    private _triggerRetryConnection;
    private _retryConnection;
    /**
     * Add commands to queue, to be executed at the right time
     */
    private _addToQueue;
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    private _diffStates;
    private _disconnectTCPClient;
    private _connectTCPClient;
    private _sendTCPMessage;
    private _defaultCommandReceiver;
    private _connectionChanged;
}
export {};
//# sourceMappingURL=index.d.ts.map