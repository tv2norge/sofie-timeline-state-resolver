/// <reference types="node" />
import { EventEmitter } from 'events';
export declare class VizEngineTcpSender extends EventEmitter {
    private _socket;
    private _port;
    private _host;
    private _connected;
    private _commandCount;
    private _sendQueue;
    private _waitQueue;
    private _incomingData;
    private _responseTimeoutMs;
    constructor(port: number, host: string);
    send(commands: string[]): void;
    private _connect;
    private _flushQueue;
    private _processData;
    private _destroy;
}
//# sourceMappingURL=vizEngineTcpSender.d.ts.map