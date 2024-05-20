import { DeviceType } from '.';
export type OSCEasingType = 'Linear' | 'Quadratic' | 'Cubic' | 'Quartic' | 'Quintic' | 'Sinusoidal' | 'Exponential' | 'Circular' | 'Elastic' | 'Back' | 'Bounce';
export declare enum TimelineContentTypeOSC {
    OSC = "osc"
}
export declare enum OSCValueType {
    INT = "i",
    FLOAT = "f",
    STRING = "s",
    BLOB = "b",
    TRUE = "T",
    FALSE = "F"
}
export interface OSCValueNumber {
    type: OSCValueType.INT | OSCValueType.FLOAT;
    value: number;
}
export interface OSCValueString {
    type: OSCValueType.STRING;
    value: string;
}
export interface OSCValueBlob {
    type: OSCValueType.BLOB;
    value: Uint8Array;
}
export interface OSCValueBoolean {
    type: OSCValueType.TRUE | OSCValueType.FALSE;
    value: void;
}
export type SomeOSCValue = OSCValueNumber | OSCValueString | OSCValueBlob | OSCValueBoolean;
export interface OSCMessageCommandContent {
    type: TimelineContentTypeOSC.OSC;
    path: string;
    values: SomeOSCValue[];
    transition?: {
        duration: number;
        type: OSCEasingType;
        direction: 'In' | 'Out' | 'InOut' | 'None';
    };
    from?: SomeOSCValue[];
}
export type TimelineContentOSCAny = TimelineContentOSCMessage;
export interface TimelineContentOSC {
    deviceType: DeviceType.OSC;
    type: TimelineContentTypeOSC;
}
export type TimelineContentOSCMessage = TimelineContentOSC & OSCMessageCommandContent;
//# sourceMappingURL=osc.d.ts.map