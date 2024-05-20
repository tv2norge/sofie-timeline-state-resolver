import { DeviceType, TcpSendCommandContent } from '.';
export declare enum TimelineContentTypeTcp {
    GET = "get",
    POST = "post",
    PUT = "put",
    DELETE = "delete"
}
export type TimelineContentTCPSendAny = TimelineContentTCPRequest;
export interface TimelineContentTCPSendBase {
    deviceType: DeviceType.TCPSEND;
}
export type TimelineContentTCPRequest = TimelineContentTCPSendBase & TcpSendCommandContent;
//# sourceMappingURL=tcpSend.d.ts.map