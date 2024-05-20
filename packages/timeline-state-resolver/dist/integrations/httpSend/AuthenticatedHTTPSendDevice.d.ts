import { HTTPSendOptions } from 'timeline-state-resolver-types';
import { HTTPSendDevice, HttpSendDeviceCommand } from '.';
export declare class AuthenticatedHTTPSendDevice extends HTTPSendDevice {
    private tokenPromise;
    private tokenRequestPending;
    private authOptions;
    private tokenRefreshTimeout;
    init(options: HTTPSendOptions): Promise<boolean>;
    private requestAccessToken;
    private clearTokenRefreshTimeout;
    private scheduleTokenRefresh;
    private refreshAccessToken;
    private makeAccessTokenRequest;
    sendCommand({ tlObjId, context, command }: HttpSendDeviceCommand): Promise<void>;
}
//# sourceMappingURL=AuthenticatedHTTPSendDevice.d.ts.map