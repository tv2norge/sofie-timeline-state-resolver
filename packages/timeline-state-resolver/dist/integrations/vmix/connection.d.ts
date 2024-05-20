import { EventEmitter } from 'eventemitter3';
import { VMixStateCommand } from './vMixCommands';
import { Response } from './vMixResponseStreamReader';
export declare enum ResponseTypes {
    Info = "INFO",
    OK = "OK",
    ClientError = "ERROR",
    ServerError = "FAILED"
}
export type ConnectionEvents = {
    data: [response: Response];
    connected: [];
    disconnected: [];
    initialized: [];
    error: [error: Error];
};
/**
 * This TSR integration polls the state of vMix and merges that into our last-known state.
 * However, not all state properties can be retried from vMix's API.
 * Therefore, there are some properties that we must "carry over" from our last-known state, every time.
 * These are those property keys for the Input state objects.
 */
export type InferredPartialInputStateKeys = 'filePath' | 'fade' | 'audioAuto' | 'restart';
export declare class BaseConnection extends EventEmitter<ConnectionEvents> {
    private host;
    private port;
    private _socket?;
    private _reconnectTimeout?;
    private _connected;
    private _responseStreamReader;
    constructor(host: string, port?: number, autoConnect?: boolean);
    get connected(): boolean;
    connect(host?: string, port?: number): void;
    disconnect(): void;
    requestVMixState(): Promise<Error | undefined>;
    sendCommandFunction(func: string, args: {
        input?: string | number;
        value?: string | number;
        extra?: string;
        duration?: number;
        mix?: number;
    }): Promise<any>;
    private _sendCommand;
    private _triggerReconnect;
    private _setupSocket;
    private _setConnected;
}
export declare class VMixConnection extends BaseConnection {
    sendCommand(command: VMixStateCommand): Promise<any>;
    setPreviewInput(input: number | string, mix: number): Promise<any>;
    transition(input: number | string, effect: string, duration: number, mix: number): Promise<any>;
    setAudioLevel(input: number | string, volume: number, fade?: number): Promise<any>;
    setAudioBalance(input: number | string, balance: number): Promise<any>;
    setAudioOn(input: number | string): Promise<any>;
    setAudioOff(input: number | string): Promise<any>;
    setAudioAutoOn(input: number | string): Promise<any>;
    setAudioAutoOff(input: number | string): Promise<any>;
    setAudioBusOn(input: number | string, value: string): Promise<any>;
    setAudioBusOff(input: number | string, value: string): Promise<any>;
    setFader(position: number): Promise<any>;
    setPanX(input: number | string, value: number): Promise<any>;
    setPanY(input: number | string, value: number): Promise<any>;
    setZoom(input: number | string, value: number): Promise<any>;
    setAlpha(input: number | string, value: number): Promise<any>;
    startRecording(): Promise<any>;
    stopRecording(): Promise<any>;
    startStreaming(): Promise<any>;
    stopStreaming(): Promise<any>;
    fadeToBlack(): Promise<any>;
    addInput(file: string): Promise<any>;
    removeInput(name: string): Promise<any>;
    playInput(input: number | string): Promise<any>;
    pauseInput(input: number | string): Promise<any>;
    setPosition(input: number | string, value: number): Promise<any>;
    loopOn(input: number | string): Promise<any>;
    loopOff(input: number | string): Promise<any>;
    setInputName(input: number | string, value: string): Promise<any>;
    setOutput(name: string, value: string, input?: number | string): Promise<any>;
    startExternal(): Promise<any>;
    stopExternal(): Promise<any>;
    overlayInputIn(name: number, input: string | number): Promise<any>;
    overlayInputOut(name: number): Promise<any>;
    setInputOverlay(input: string | number, index: number, value: string | number): Promise<any>;
    scriptStart(value: string): Promise<any>;
    scriptStop(value: string): Promise<any>;
    scriptStopAll(): Promise<any>;
    lastPreset(): Promise<any>;
    openPreset(file: string): Promise<any>;
    savePreset(file: string): Promise<any>;
    listAdd(input: string | number, value: string | number): Promise<any>;
    listRemoveAll(input: string | number): Promise<any>;
    restart(input: string | number): Promise<any>;
}
//# sourceMappingURL=connection.d.ts.map