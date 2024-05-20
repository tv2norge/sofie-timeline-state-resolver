import { EventEmitter } from 'eventemitter3';
import { TriCasterProductInfo, TriCasterSwitcherInfo } from './triCasterInfoParser';
import { TriCasterCommand } from './triCasterCommands';
export interface TriCasterConnectionEvents {
    connected: (info: TriCasterInfo, shortcutStateXml: string) => void;
    disconnected: (reason: string) => void;
    error: (reason: any) => void;
}
export interface TriCasterInfo extends TriCasterSwitcherInfo, TriCasterProductInfo {
}
export declare class TriCasterConnection extends EventEmitter<TriCasterConnectionEvents> {
    private _host;
    private _port;
    private _socket;
    private _pingTimeout;
    private _isClosing;
    constructor(_host: string, _port: number);
    connect(): void;
    private handleOpen;
    private handleClose;
    private handleError;
    private ping;
    send(message: TriCasterCommand): Promise<void>;
    close(): void;
    private getInfo;
    private getShortcutStates;
}
//# sourceMappingURL=triCasterConnection.d.ts.map