import { DeviceType, AtemOptions, CasparCGOptions, HTTPSendOptions, HyperdeckOptions, OBSOptions, OSCOptions, PharosOptions, QuantelOptions, SingularLiveOptions, SisyfosOptions, SofieChefOptions, TCPSendOptions, AbstractOptions, LawoOptions, PanasonicPTZOptions, HTTPWatcherOptions, VizMSEOptions, VMixOptions, ShotokuOptions, TelemetricsOptions, TriCasterOptions, MultiOSCOptions } from '.';
import { DeviceCommonOptions } from './generated/common-options';
export declare enum StatusCode {
    UNKNOWN = 0,
    GOOD = 1,
    WARNING_MINOR = 2,
    WARNING_MAJOR = 3,
    BAD = 4,
    FATAL = 5
}
export interface DeviceStatus {
    statusCode: StatusCode;
    messages: Array<string>;
    active: boolean;
}
export interface DeviceOptionsBase<T> extends SlowReportOptions, DeviceCommonOptions {
    type: DeviceType;
    isMultiThreaded?: boolean;
    reportAllCommands?: boolean;
    options?: T;
}
export interface SlowReportOptions {
    /** If set, report back that a command was slow if not sent at this time */
    limitSlowSentCommand?: number;
    /** If set, report back that a command was slow if not fullfilled (sent + ack:ed) at this time */
    limitSlowFulfilledCommand?: number;
}
export type DeviceOptionsAny = DeviceOptionsAbstract | DeviceOptionsCasparCG | DeviceOptionsAtem | DeviceOptionsLawo | DeviceOptionsHTTPSend | DeviceOptionsPanasonicPTZ | DeviceOptionsTCPSend | DeviceOptionsHyperdeck | DeviceOptionsPharos | DeviceOptionsOBS | DeviceOptionsOSC | DeviceOptionsHTTPWatcher | DeviceOptionsSisyfos | DeviceOptionsSofieChef | DeviceOptionsQuantel | DeviceOptionsSingularLive | DeviceOptionsVMix | DeviceOptionsVizMSE | DeviceOptionsShotoku | DeviceOptionsTelemetrics | DeviceOptionsTriCaster | DeviceOptionsMultiOSC;
export interface DeviceOptionsAbstract extends DeviceOptionsBase<AbstractOptions> {
    type: DeviceType.ABSTRACT;
}
export interface DeviceOptionsCasparCG extends DeviceOptionsBase<CasparCGOptions> {
    type: DeviceType.CASPARCG;
}
export interface DeviceOptionsAtem extends DeviceOptionsBase<AtemOptions> {
    type: DeviceType.ATEM;
}
export interface DeviceOptionsLawo extends DeviceOptionsBase<LawoOptions> {
    type: DeviceType.LAWO;
}
export interface DeviceOptionsHTTPSend extends DeviceOptionsBase<HTTPSendOptions> {
    type: DeviceType.HTTPSEND;
}
export interface DeviceOptionsPanasonicPTZ extends DeviceOptionsBase<PanasonicPTZOptions> {
    type: DeviceType.PANASONIC_PTZ;
}
export interface DeviceOptionsTCPSend extends DeviceOptionsBase<TCPSendOptions> {
    type: DeviceType.TCPSEND;
}
export interface DeviceOptionsHyperdeck extends DeviceOptionsBase<HyperdeckOptions> {
    type: DeviceType.HYPERDECK;
}
export interface DeviceOptionsPharos extends DeviceOptionsBase<PharosOptions> {
    type: DeviceType.PHAROS;
}
export interface DeviceOptionsOBS extends DeviceOptionsBase<OBSOptions> {
    type: DeviceType.OBS;
}
export interface DeviceOptionsOSC extends DeviceOptionsBase<OSCOptions> {
    type: DeviceType.OSC;
}
export interface DeviceOptionsHTTPWatcher extends DeviceOptionsBase<HTTPWatcherOptions> {
    type: DeviceType.HTTPWATCHER;
}
export interface DeviceOptionsSisyfos extends DeviceOptionsBase<SisyfosOptions> {
    type: DeviceType.SISYFOS;
}
export interface DeviceOptionsSofieChef extends DeviceOptionsBase<SofieChefOptions> {
    type: DeviceType.SOFIE_CHEF;
}
export interface DeviceOptionsQuantel extends DeviceOptionsBase<QuantelOptions> {
    type: DeviceType.QUANTEL;
}
export interface DeviceOptionsVizMSE extends DeviceOptionsBase<VizMSEOptions> {
    type: DeviceType.VIZMSE;
}
export interface DeviceOptionsSingularLive extends DeviceOptionsBase<SingularLiveOptions> {
    type: DeviceType.SINGULAR_LIVE;
}
export interface DeviceOptionsShotoku extends DeviceOptionsBase<ShotokuOptions> {
    type: DeviceType.SHOTOKU;
}
export interface DeviceOptionsVMix extends DeviceOptionsBase<VMixOptions> {
    type: DeviceType.VMIX;
}
export interface DeviceOptionsTelemetrics extends DeviceOptionsBase<TelemetricsOptions> {
    type: DeviceType.TELEMETRICS;
}
export interface DeviceOptionsTriCaster extends DeviceOptionsBase<TriCasterOptions> {
    type: DeviceType.TRICASTER;
}
export interface DeviceOptionsMultiOSC extends DeviceOptionsBase<MultiOSCOptions> {
    type: DeviceType.MULTI_OSC;
}
//# sourceMappingURL=device.d.ts.map